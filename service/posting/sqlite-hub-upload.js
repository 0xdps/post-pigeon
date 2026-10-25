// service/posting/sqlite-hub-upload.js
// File upload and management via @mesahub/client file storage.
import fs from "fs/promises";
import path from "path";
import { parseMesahubUrl } from "@mesahub/client";
import { getDb } from "../core/db.js";

function buildProxyFileUrl(fileId) {
	return `/api/posts/files/${encodeURIComponent(fileId)}`;
}

function getFilesClient() {
	return getDb().files;
}

const LOCAL_PREFIX = "local:";
const LOCAL_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "data/uploads");

function isLocalFile(fileId) {
	return String(fileId || "").startsWith(LOCAL_PREFIX);
}

async function saveLocalFile(buffer, filename, mimeType) {
	await fs.mkdir(LOCAL_DIR, { recursive: true });
	const ext = path.extname(filename);
	const base = path.basename(filename, ext).replace(/[^\w.-]+/g, "-").slice(0, 64) || "file";
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${base}${ext}`;
	await fs.writeFile(path.join(LOCAL_DIR, id), buffer);
	await fs.writeFile(path.join(LOCAL_DIR, `${id}.meta.json`), JSON.stringify({ filename, mimeType, size: buffer.length }));
	return { id: `${LOCAL_PREFIX}${id}`, filename, size: buffer.length };
}

async function readLocalFile(fileId) {
	const name = path.basename(String(fileId).slice(LOCAL_PREFIX.length));
	const filePath = path.join(LOCAL_DIR, name);
	try {
		const [buffer, metaRaw] = await Promise.all([
			fs.readFile(filePath),
			fs.readFile(`${filePath}.meta.json`, "utf8").catch(() => "{}"),
		]);
		const meta = JSON.parse(metaRaw);
		return {
			file_path: fileId,
			filename: meta.filename || name,
			mime_type: meta.mimeType || "application/octet-stream",
			size: buffer.length,
			buffer,
		};
	} catch (err) {
		if (err?.code === "ENOENT") return null;
		throw err;
	}
}

/**
 * Build the direct authenticated download URL for a file.
 * Used for backend-to-backend fetches (e.g. reading file content before posting).
 * @param {string} fileId
 * @returns {string|null}
 */
function buildDirectDownloadUrl(fileId) {
	const url = process.env.MESAHUB_URL;
	if (!url) return null;
	try {
		const { apiUrl, dbName, routePrefix } = parseMesahubUrl(url);
		return `${apiUrl}/${routePrefix}/files/${dbName}/${encodeURIComponent(fileId)}`;
	} catch {
		return null;
	}
}

/**
 * Upload a file to MesaHub file storage.
 * @param {Buffer|string} fileData - File buffer or file path
 * @param {string} _customPath     - Unused (kept for call-site compatibility)
 * @param {string} filename        - Original filename
 * @param {string} mimeType        - Mime type of file
 * @returns {Promise<{file_path: string, url: string, proxy_url: string, download_url: string|null, file_id: string, filename: string, size: number}>}
 */
export async function uploadFileToHub(
	fileData,
	_customPath = "posts",
	filename = "file",
	mimeType = "application/octet-stream"
) {
	const files = getFilesClient();

	try {
		let buffer;

		if (typeof fileData === "string") {
			buffer = await fs.readFile(fileData);
			filename = path.basename(fileData);
		} else {
			buffer = fileData;
		}

		// Derive a unique filename so re-uploads don't overwrite each other.
		const ext = path.extname(filename);
		const base = path.basename(filename, ext).replace(/\s+/g, "-").slice(0, 64) || "file";
		const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${base}${ext}`;

		// @mesahub/client accepts Blob or ArrayBuffer.
		let uploaded;
		try {
			const blob = new Blob([buffer], { type: mimeType });
			uploaded = await files.upload(blob, uniqueName, mimeType);
		} catch (err) {
			if (!/not found/i.test(err?.message || "")) throw err;
			console.warn("[mesahub] Files API unavailable, storing upload locally");
			uploaded = await saveLocalFile(buffer, uniqueName, mimeType);
		}

		const downloadUrl = buildDirectDownloadUrl(uploaded.id);
		console.log(`[mesahub] Uploaded file ${filename} → ${uploaded.id}`);

		return {
			file_path: uploaded.id,
			url: uploaded.url || buildProxyFileUrl(uploaded.id),
			proxy_url: buildProxyFileUrl(uploaded.id),
			download_url: downloadUrl,
			file_id: uploaded.id,
			filename,
			size: buffer.length,
		};
	} catch (err) {
		console.error("[mesahub] Upload failed:", err.message);
		throw new Error(`Failed to upload file: ${err.message}`);
	}
}

/**
 * Delete a file from SQLite Hub
 * @param {string} filePath - Path returned from upload (e.g., '/posts/001/file.jpg')
 * @returns {Promise<void>}
 */
export async function deleteFileFromHub(filePath) {
	if (isLocalFile(filePath)) {
		const name = path.basename(String(filePath).slice(LOCAL_PREFIX.length));
		await fs.rm(path.join(LOCAL_DIR, name), { force: true });
		await fs.rm(path.join(LOCAL_DIR, `${name}.meta.json`), { force: true });
		return;
	}
	const files = getFilesClient();

	try {
		if (!filePath) {
			throw new Error("filePath required");
		}

		console.log(`[mesahub] Deleting file ${filePath}`);
		await files.delete(filePath);
		console.log(`[mesahub] File deleted: ${filePath}`);
	} catch (err) {
		console.error("[mesahub] Delete failed:", err.message);
		// Don't throw — log and continue (file may already be deleted)
	}
}

/**
 * Get file URL from path
 * @param {string} filePath - Path returned from upload
 * @returns {string} Full URL
 */
export function getFileUrl(filePath) {
	if (!filePath) return null;
	return buildProxyFileUrl(filePath);
}

/**
 * Read file data from MesaHub file storage.
 * Uses the file download stream and converts it to a Buffer.
 * @param {string} fileId
 * @returns {Promise<{file_path: string, filename: string, mime_type: string, size: number, buffer: Buffer} | null>}
 */
export async function getFileFromHub(fileId) {
	if (!fileId) return null;
	if (isLocalFile(fileId)) return readLocalFile(fileId);

	const files = getFilesClient();

	try {
		const streamResp = await files.download(fileId);

		if (!streamResp || streamResp.status === 404) return null;
		if (streamResp.status >= 400) {
			throw new Error(`Failed to fetch file ${fileId}: HTTP ${streamResp.status}`);
		}

		// Consume the ReadableStream (Node.js or web streams both support async iteration).
		const chunks = [];
		for await (const chunk of streamResp.stream) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		const buffer = Buffer.concat(chunks);

		// content-type may be a plain object or a Headers-like map
		const headers = streamResp.headers || {};
		const contentType =
			(typeof headers.get === "function" ? headers.get("content-type") : headers["content-type"]) ||
			"application/octet-stream";

		return {
			file_path: fileId,
			filename: fileId.split("/").pop() || "file",
			mime_type: contentType,
			size: buffer.length,
			buffer,
		};
	} catch (err) {
		// Treat any 404-like error as "not found" rather than a hard failure.
		if (err?.message?.includes("404") || err?.status === 404) return null;
		throw err;
	}
}

/**
 * List all file IDs stored in MesaHub file storage.
 * @returns {Promise<Set<string>>}
 */
export async function listAllFileIdsFromHub() {
	const files = getFilesClient();
	const ids = new Set();

	let offset = 0;
	const limit = 100;

	while (true) {
		const page = await files.list({ offset, limit });
		for (const f of page.files || []) {
			ids.add(f.id);
		}

		offset += page.files?.length || 0;
		if (!page.files || page.files.length < limit) break;
	}

	return ids;
}

/**
 * Presigned URLs are not supported by @mesahub/client.
 * Returns null so call sites fall back to the backend proxy URL automatically.
 * @returns {Promise<null>}
 */
export async function createPresignedFileUrl(_fileId, _expiresInSeconds = 3600) {
	return null;
}

/**
 * Long-lived read session tokens are not supported by @mesahub/client.
 * Returns null; call sites should use the backend proxy for file access.
 * @returns {Promise<null>}
 */
export async function createFileReadSessionToken(_expiresInSeconds = 30 * 24 * 60 * 60) {
	return null;
}

/**
 * Validate file before upload
 * @param {File|Buffer} file - File object or buffer
 * @param {number} maxSizeBytes - Max allowed size
 * @returns {{valid: boolean, error?: string, size: number}}
 */
export function validateFile(file, maxSizeBytes = 10 * 1024 * 1024) {
	// 10MB default
	let size = 0;

	if (typeof File !== "undefined" && file instanceof File) {
		size = file.size;
	} else if (Buffer.isBuffer(file)) {
		size = file.length;
	} else {
		return { valid: false, error: "Invalid file type", size: 0 };
	}

	if (size > maxSizeBytes) {
		return {
			valid: false,
			error: `File too large (${Math.round(size / 1024 / 1024)}MB > ${Math.round(maxSizeBytes / 1024 / 1024)}MB)`,
			size,
		};
	}

	return { valid: true, size };
}

/**
 * Validate image mime type
 * @param {string} mimeType
 * @returns {boolean}
 */
export function isValidImageType(mimeType) {
	const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
	return validTypes.includes(mimeType);
}
