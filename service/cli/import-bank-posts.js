import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { initDb, getDb } from "../core/db.js";
import { BANK_PATH } from "../core/config.js";
import { uploadFileToHub } from "../posting/sqlite-hub-upload.js";

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

async function main() {
	await initDb();
	const db = getDb();

	const bankRaw = await fs.readFile(BANK_PATH, "utf8");
	const bank = JSON.parse(bankRaw);

	if (!Array.isArray(bank) || bank.length === 0) {
		throw new Error(`Bank file is empty: ${BANK_PATH}`);
	}

	const summary = {
		total: bank.length,
		postsUpserted: 0,
		contentUpserted: 0,
		imagesCreated: 0,
		imagesExisting: 0,
		mediaMissing: 0,
		failed: 0,
	};

	for (const item of bank) {
		const bankId = String(item.id);
		const postId = toPostId(bankId);
		const contentId = toContentId(bankId);
		const now = Date.now();

		try {
			const textPath = path.resolve(process.cwd(), item.text_file);
			const text = (await fs.readFile(textPath, "utf8")).trim();
			const title = buildTitle(text, bankId);

			const existingPost = await db.findById("posts", postId);
			await db.upsert("posts", {
				id: postId,
				type: "standalone",
				title,
				status: "draft",
				metadata: JSON.stringify({
					source: "bank-import",
					legacy_id: bankId,
					text_file: item.text_file,
				}),
				created_at: existingPost?.created_at || now,
				updated_at: now,
			});
			summary.postsUpserted += 1;

			const mediaIds = [];
			const mediaList = Array.isArray(item.media) ? item.media : [];

			for (let i = 0; i < mediaList.length; i += 1) {
				const mediaPath = mediaList[i];
				const imageId = toImageId(bankId, i);
				const existingImage = await db.findById("post_images", imageId);

				if (existingImage) {
					mediaIds.push(imageId);
					summary.imagesExisting += 1;
					continue;
				}

				const absoluteMediaPath = path.resolve(process.cwd(), mediaPath);
				let stat;
				try {
					stat = await fs.stat(absoluteMediaPath);
				} catch {
					summary.mediaMissing += 1;
					console.warn(`[import-bank] media file missing for ${postId}: ${absoluteMediaPath}`);
					continue;
				}

				const upload = await uploadFileToHub(
					absoluteMediaPath,
					`posts/${postId}`,
					path.basename(absoluteMediaPath),
					guessMimeType(absoluteMediaPath)
				);

				await db.upsert("post_images", {
					id: imageId,
					post_id: postId,
					filename: path.basename(absoluteMediaPath),
					mime_type: guessMimeType(absoluteMediaPath),
					size: stat.size,
					file_path: upload.file_path,
					created_at: now,
				});

				mediaIds.push(imageId);
				summary.imagesCreated += 1;
			}

			const existingContent = await db.findById("post_content", contentId);
			await db.upsert("post_content", {
				id: contentId,
				post_id: postId,
				sequence: 1,
				text,
				media_ids: JSON.stringify(mediaIds),
				reply_to_tweet_id: null,
				created_at: existingContent?.created_at || now,
			});
			summary.contentUpserted += 1;
		} catch (err) {
			summary.failed += 1;
			console.error(`[import-bank] failed for bank id ${bankId}: ${err.message}`);
		}
	}

	console.log("[import-bank] done", JSON.stringify(summary, null, 2));

	if (summary.failed > 0) {
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error("[import-bank] fatal:", err);
	process.exit(1);
});
