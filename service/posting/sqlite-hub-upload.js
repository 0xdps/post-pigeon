// service/posting/sqlite-hub-upload.js
// SQLite Hub file upload and management functions
import fs from "fs/promises";
import path from "path";
import { getDb } from "../core/db.js";

function normalizeStoragePath(customPath = "posts") {
	const sanitized = String(customPath || "posts")
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "");
	return sanitized || "posts";
}

function buildProxyFileUrl(fileId) {
	return `/api/posts/files/${encodeURIComponent(fileId)}`;
}

function getFilesClient() {
	const db = getDb();
	if (!db.files) {
		throw new Error("sqlite-hub-client files API not available. Install sqlite-hub-client@0.8.0+");
	}
	return db.files;
}

/**
 * Upload a file to SQLite Hub
 * @param {Buffer|string} fileData - File buffer or file path
 * @param {string} customPath - Optional custom path (e.g., 'posts/001')
 * @param {string} filename - Original filename
 * @param {string} mimeType - Mime type of file
 * @returns {Promise<{file_path: string, url: string}>}
 */
export async function uploadFileToHub(
	fileData,
	customPath = "posts",
	filename = "file",
	mimeType = "application/octet-stream"
) {
	const files = getFilesClient();

	try {
		let buffer;

		// If fileData is a string (file path), read it
		if (typeof fileData === "string") {
			buffer = await fs.readFile(fileData);
			filename = path.basename(fileData);
		} else {
			// Assume it's a Buffer
			buffer = fileData;
		}

		// Generate unique file path
		const normalizedPath = normalizeStoragePath(customPath);
		const ext = path.extname(filename);
		const base = path.basename(filename, ext).replace(/\s+/g, "-").slice(0, 64) || "file";
		const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${base}${ext}`;

		const uploaded = await files.upload({
			file: buffer,
			filename: uniqueName,
			folderPath: normalizedPath,
			conflictMode: "replace",
			metadata: { original_filename: filename, source: "posthub" },
		});

		let signed = null;
		try {
			signed = await files.presign(uploaded.id, {
				expiresIn: 3600,
				disposition: "inline",
			});
		} catch (presignErr) {
			console.warn(`[sqlite-hub] Presign unavailable for ${uploaded.id}: ${presignErr.message}`);
		}

		console.log(`[sqlite-hub] Uploaded file ${filename} -> ${uploaded.id}`);

		return {
			file_path: uploaded.id,
			url: signed?.url || buildProxyFileUrl(uploaded.id),
			proxy_url: buildProxyFileUrl(uploaded.id),
			download_url: files.getDownloadUrl(uploaded.id),
			file_id: uploaded.id,
			filename,
			size: buffer.length,
		};
	} catch (err) {
		console.error("[sqlite-hub] Upload failed:", err.message);
		throw new Error(`Failed to upload file: ${err.message}`);
	}
}

/**
 * Delete a file from SQLite Hub
 * @param {string} filePath - Path returned from upload (e.g., '/posts/001/file.jpg')
 * @returns {Promise<void>}
 */
export async function deleteFileFromHub(filePath) {
	const files = getFilesClient();

	try {
		if (!filePath) {
			throw new Error("filePath required");
		}

		console.log(`[sqlite-hub] Deleting file ${filePath}`);
		await files.delete(filePath);
		console.log(`[sqlite-hub] File deleted: ${filePath}`);
	} catch (err) {
		console.error("[sqlite-hub] Delete failed:", err.message);
		// Don't throw - log and continue (file may already be deleted)
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
 * Read file data from SQLite Hub file storage
 * @param {string} fileId
 * @returns {Promise<{file_path: string, filename: string, mime_type: string, size: number, buffer: Buffer} | null>}
 */
export async function getFileFromHub(fileId) {
	if (!fileId) return null;

	const files = getFilesClient();
	const token = process.env.SQLITE_HUB_SERVICE_SECRET;

	const [meta, response] = await Promise.all([
		files.getMeta(fileId),
		fetch(files.getDownloadUrl(fileId), {
			headers: token ? { Authorization: `Bearer ${token}` } : undefined,
		}),
	]);

	if (!response.ok) {
		if (response.status === 404) return null;
		throw new Error(`Failed to fetch file ${fileId}: HTTP ${response.status}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const contentType = response.headers.get("content-type") || meta?.content_type || "application/octet-stream";

	return {
		file_path: fileId,
		filename: meta?.filename || "file",
		mime_type: contentType,
		size: Number(meta?.size_bytes) || arrayBuffer.byteLength,
		buffer: Buffer.from(arrayBuffer),
	};
}

/**
 * List all file ids from SQLite Hub file API
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
 * Create long-lived read-only file token for frontend direct access.
 * @param {number} expiresInSeconds
 */
export async function createFileReadSessionToken(expiresInSeconds = 30 * 24 * 60 * 60) {
	const files = getFilesClient();
	const result = await files.createFileAccessToken({
		scope: "files:read",
		expiresIn: expiresInSeconds,
		description: "posthub-dashboard",
	});
	return result.token;
}

/**
 * Create a presigned URL for a stored file.
 * @param {string} fileId
 * @param {number} expiresInSeconds
 */
export async function createPresignedFileUrl(fileId, expiresInSeconds = 3600) {
	const files = getFilesClient();
	return files.presign(fileId, {
		expiresIn: expiresInSeconds,
		disposition: "inline",
	});
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
