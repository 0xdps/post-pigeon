import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { initDb, getDb } from "../core/db.js";
import { BANK_PATH } from "../core/config.js";

const HUB_TEXT_PREFIX = "@hub:";

function toPostId(bankId) {
	return `bank-${String(bankId)}`;
}

function toContentId(bankId) {
	return `content-bank-${String(bankId)}`;
}

function toImageId(bankId, index) {
	return `img-bank-${String(bankId)}-${index + 1}`;
}

function guessMimeType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
	if (ext === ".png") return "image/png";
	if (ext === ".gif") return "image/gif";
	if (ext === ".webp") return "image/webp";
	if (ext === ".avif") return "image/avif";
	if (ext === ".md") return "text/markdown";
	if (ext === ".txt") return "text/plain";
	return "application/octet-stream";
}

function buildTitle(text, bankId) {
	const firstLine = String(text || "")
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0);

	if (!firstLine) {
		return `Imported Post ${bankId}`;
	}

	const cleaned = firstLine.replace(/^#+\s*/, "").trim();
	return cleaned.slice(0, 100);
}

function fileKey(folderPath, filename) {
	return `${folderPath}/${filename}`;
}

async function listAllFiles(filesApi) {
	const byKey = new Map();
	let offset = 0;
	const limit = 100;

	while (true) {
		const page = await filesApi.list({ offset, limit });
		for (const f of page.files || []) {
			byKey.set(fileKey(f.folder_path, f.filename), f);
		}
		offset += page.files?.length || 0;
		if (!page.files || page.files.length < limit) break;
	}

	return byKey;
}

async function ensureHubFile({ filesApi, fileMap, localPath, folderPath, filename, contentType }) {
	const key = fileKey(folderPath, filename);
	const existing = fileMap.get(key);
	if (existing?.id) {
		return existing.id;
	}

	const buffer = await fs.readFile(localPath);
	const uploaded = await filesApi.upload({
		file: buffer,
		filename,
		folderPath,
		conflictMode: "replace",
		...(contentType ? { contentType } : {}),
		metadata: {
			source: "bank-sync",
			local_path: localPath,
		},
	});

	fileMap.set(key, {
		id: uploaded.id,
		filename,
		folder_path: folderPath,
	});

	return uploaded.id;
}

async function main() {
	await initDb();
	const db = getDb();

	if (!db.files) {
		throw new Error("sqlite-hub-client files API unavailable. Install sqlite-hub-client@0.8.0+");
	}

	const bankRaw = await fs.readFile(BANK_PATH, "utf8");
	const bank = JSON.parse(bankRaw);

	if (!Array.isArray(bank) || bank.length === 0) {
		throw new Error(`Bank file is empty: ${BANK_PATH}`);
	}

	const fileMap = await listAllFiles(db.files);
	const summary = {
		total: bank.length,
		postsUpserted: 0,
		contentUpserted: 0,
		imagesUpserted: 0,
		filesUploaded: 0,
		failed: 0,
	};

	for (const item of bank) {
		const bankId = String(item.id);
		const postId = toPostId(bankId);
		const contentId = toContentId(bankId);
		const now = Date.now();
		const postFolderPath = `bank/posts/${bankId}`;

		try {
			const textPath = path.resolve(process.cwd(), item.text_file);
			const textRaw = await fs.readFile(textPath, "utf8");
			const text = textRaw.trim();
			const title = buildTitle(text, bankId);

			const textFileName = "text.md";
			const textFileIdBefore = fileMap.get(fileKey(postFolderPath, textFileName))?.id || null;
			const textFileId = await ensureHubFile({
				filesApi: db.files,
				fileMap,
				localPath: textPath,
				folderPath: postFolderPath,
				filename: textFileName,
				contentType: "text/markdown",
			});
			if (!textFileIdBefore) summary.filesUploaded += 1;

			const mediaIds = [];
			const mediaList = Array.isArray(item.media) ? item.media : [];

			for (let i = 0; i < mediaList.length; i += 1) {
				const mediaPath = mediaList[i];
				const imageId = toImageId(bankId, i);
				const absMediaPath = path.resolve(process.cwd(), mediaPath);
				const filename = path.basename(absMediaPath);
				const folderPath = postFolderPath;

				const fileIdBefore = fileMap.get(fileKey(folderPath, filename))?.id || null;
				const hubFileId = await ensureHubFile({
					filesApi: db.files,
					fileMap,
					localPath: absMediaPath,
					folderPath,
					filename,
					contentType: undefined,
				});
				if (!fileIdBefore) summary.filesUploaded += 1;

				const stat = await fs.stat(absMediaPath);
				await db.upsert("post_images", {
					id: imageId,
					post_id: postId,
					filename,
					mime_type: guessMimeType(absMediaPath),
					size: stat.size,
					file_path: hubFileId,
					created_at: now,
				});

				mediaIds.push(imageId);
				summary.imagesUpserted += 1;
			}

			const existingPost = await db.findById("posts", postId);
			await db.upsert("posts", {
				id: postId,
				type: "standalone",
				title,
				status: "draft",
				metadata: JSON.stringify({
					source: "bank-sync",
					legacy_id: bankId,
					text_file_id: textFileId,
				}),
				created_at: existingPost?.created_at || now,
				updated_at: now,
			});
			summary.postsUpserted += 1;

			const existingContent = await db.findById("post_content", contentId);
			await db.upsert("post_content", {
				id: contentId,
				post_id: postId,
				sequence: 1,
				text: `${HUB_TEXT_PREFIX}${textFileId}`,
				media_ids: JSON.stringify(mediaIds),
				reply_to_tweet_id: null,
				created_at: existingContent?.created_at || now,
			});
			summary.contentUpserted += 1;
		} catch (err) {
			summary.failed += 1;
			console.error(`[sync] failed for bank id ${bankId}: ${err.message}`);
		}
	}

	console.log("[sync] done", JSON.stringify(summary, null, 2));

	if (summary.failed > 0) {
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error("[sync] fatal:", err);
	process.exit(1);
});
