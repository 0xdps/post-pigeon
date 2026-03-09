import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { initDb, getDb } from "../core/db.js";
import { uploadFileToHub } from "../posting/sqlite-hub-upload.js";

function parseArgs(argv) {
	const options = {
		dryRun: false,
		limit: null,
		legacyBaseUrl: process.env.SQLITE_HUB_URL || "",
	};

	for (const arg of argv) {
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}

		if (arg.startsWith("--limit=")) {
			const value = Number(arg.split("=")[1]);
			if (Number.isFinite(value) && value > 0) {
				options.limit = Math.floor(value);
			}
			continue;
		}

		if (arg.startsWith("--legacy-base-url=")) {
			options.legacyBaseUrl = arg.split("=")[1] || "";
		}
	}

	return options;
}

function legacyUrlFor(baseUrl, filePath) {
	if (!baseUrl || !filePath) return null;
	const normalizedBase = baseUrl.replace(/\/+$/, "");
	const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
	return `${normalizedBase}${normalizedPath}`;
}

function looksLikeLegacyPath(ref) {
	return typeof ref === "string" && ref.startsWith("/");
}

function folderFromImage(image) {
	const postId = image?.post_id || "posts";
	return `posts/${postId}`;
}

async function tryReadLocalFile(postImage) {
	const candidates = [];

	if (postImage.file_path) {
		candidates.push(postImage.file_path);
		candidates.push(path.resolve(process.cwd(), postImage.file_path.replace(/^\/+/, "")));
	}

	if (postImage.filename) {
		candidates.push(path.resolve(process.cwd(), "content/media", postImage.filename));
	}

	for (const candidate of candidates) {
		try {
			const data = await fs.readFile(candidate);
			return { buffer: data, source: `local:${candidate}` };
		} catch {
			// try next candidate
		}
	}

	return null;
}

async function tryFetchLegacyFile(postImage, baseUrl) {
	const url = legacyUrlFor(baseUrl, postImage.file_path);
	if (!url) return null;

	const token = process.env.SQLITE_HUB_SERVICE_SECRET;
	const headers = token ? { Authorization: `Bearer ${token}` } : {};

	try {
		let response = await fetch(url);
		if (!response.ok && token) {
			response = await fetch(url, { headers });
		}

		if (!response.ok) {
			return null;
		}

		const arrayBuffer = await response.arrayBuffer();
		return { buffer: Buffer.from(arrayBuffer), source: `legacy:${url}` };
	} catch {
		return null;
	}
}

async function tryReadLegacyTableBlob(db, filePath) {
	try {
		const row = await db.findOne("hub_files", { file_path: filePath });
		if (!row?.content_base64) return null;
		return {
			buffer: Buffer.from(row.content_base64, "base64"),
			source: `legacy-table:${filePath}`,
		};
	} catch {
		return null;
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	await initDb();
	const db = getDb();
	if (!db.files) {
		throw new Error("sqlite-hub-client files API unavailable. Upgrade to sqlite-hub-client@0.8.0+");
	}

	const allImages = await db.find("post_images", {}, { orderBy: "created_at", order: "ASC" });
	const images = options.limit ? allImages.slice(0, options.limit) : allImages;

	const summary = {
		total: images.length,
		alreadyNative: 0,
		migrated: 0,
		missingSource: 0,
		failed: 0,
		dryRun: options.dryRun,
	};

	console.log(`[backfill] scanning ${images.length} image records`);

	for (const image of images) {
		try {
			const currentRef = image.file_path;
			if (!currentRef) {
				summary.missingSource += 1;
				console.warn(`[backfill] missing file_path for image ${image.id}`);
				continue;
			}

			if (!looksLikeLegacyPath(currentRef)) {
				try {
					await db.files.getMeta(currentRef);
					summary.alreadyNative += 1;
					continue;
				} catch {
					// reference is not a valid native file id; migrate below
				}
			}

			let resolved = await tryReadLegacyTableBlob(db, currentRef);
			if (!resolved) {
				resolved = await tryReadLocalFile(image);
			}
			if (!resolved) {
				resolved = await tryFetchLegacyFile(image, options.legacyBaseUrl);
			}

			if (!resolved) {
				summary.missingSource += 1;
				console.warn(`[backfill] source not found for ${currentRef} (image ${image.id})`);
				continue;
			}

			if (!options.dryRun) {
				const uploaded = await uploadFileToHub(
					resolved.buffer,
					folderFromImage(image),
					image.filename || path.basename(currentRef),
					image.mime_type || "application/octet-stream"
				);

				await db.update(
					"post_images",
					{ file_path: uploaded.file_id || uploaded.file_path },
					{ id: image.id }
				);
			}

			summary.migrated += 1;
			console.log(
				`[backfill] ${options.dryRun ? "would migrate" : "migrated"} image ${image.id} (${currentRef}) using ${resolved.source}`
			);
		} catch (err) {
			summary.failed += 1;
			console.error(`[backfill] failed for image ${image.id}: ${err.message}`);
		}
	}

	console.log("[backfill] done", JSON.stringify(summary, null, 2));

	if (summary.failed > 0) {
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error("[backfill] fatal:", err);
	process.exit(1);
});
