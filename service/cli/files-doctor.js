import "dotenv/config";
import { spawn } from "child_process";
import { initDb, getDb } from "../core/db.js";

function parseArgs(argv) {
	const options = {
		sync: false,
		cleanup: false,
		dryRun: false,
		legacyBaseUrl: process.env.SQLITE_HUB_URL || "",
	};

	for (const arg of argv) {
		if (arg === "--sync") options.sync = true;
		if (arg === "--cleanup") options.cleanup = true;
		if (arg === "--dry-run") options.dryRun = true;
		if (arg.startsWith("--legacy-base-url=")) {
			options.legacyBaseUrl = arg.split("=")[1] || "";
		}
	}

	return options;
}

function runNodeScript(scriptPath, args = []) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [scriptPath, ...args], {
			stdio: "inherit",
			env: process.env,
		});

		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${scriptPath} exited with code ${code}`));
		});
	});
}

async function listAllHubFileIds(db) {
	const ids = new Set();
	let offset = 0;
	const limit = 100;

	while (true) {
		const page = await db.files.list({ offset, limit });
		for (const f of page.files || []) ids.add(f.id);
		offset += page.files?.length || 0;
		if (!page.files || page.files.length < limit) break;
	}

	return ids;
}

async function getStatus(db) {
	const [posts, postContent, postImages] = await Promise.all([
		db.count("posts"),
		db.count("post_content"),
		db.count("post_images"),
	]);

	const imageRows = await db.find("post_images", {}, { columns: ["id", "post_id", "file_path", "filename"] });
	const referencedIds = new Set(imageRows.map((r) => r.file_path).filter(Boolean));
	const hubFileIds = await listAllHubFileIds(db);

	const orphaned = imageRows.filter((row) => !hubFileIds.has(row.file_path));
	const unreferenced = [...hubFileIds].filter((id) => !referencedIds.has(id));

	return {
		posts,
		post_content: postContent,
		post_images: postImages,
		referenced_file_ids: referencedIds.size,
		hub_files_api: hubFileIds.size,
		orphaned_count: orphaned.length,
		unreferenced_count: unreferenced.length,
		orphaned_sample: orphaned.slice(0, 10),
		unreferenced_sample: unreferenced.slice(0, 10),
		unreferenced_ids: unreferenced,
	};
}

async function cleanupUnreferenced(db, ids, dryRun) {
	if (ids.length === 0) {
		console.log("[files-doctor] No unreferenced files to cleanup.");
		return { deleted: 0, failed: 0 };
	}

	let deleted = 0;
	let failed = 0;

	for (const fileId of ids) {
		try {
			if (!dryRun) {
				await db.files.delete(fileId);
			}
			deleted += 1;
			console.log(`[files-doctor] ${dryRun ? "would delete" : "deleted"}: ${fileId}`);
		} catch (err) {
			failed += 1;
			console.error(`[files-doctor] failed to delete ${fileId}: ${err.message}`);
		}
	}

	return { deleted, failed };
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.sync) {
		console.log("[files-doctor] Sync enabled: importing bank posts (idempotent) and running backfill...");
		await runNodeScript("service/cli/import-bank-posts.js");

		const backfillArgs = [];
		if (options.dryRun) backfillArgs.push("--dry-run");
		if (options.legacyBaseUrl) backfillArgs.push(`--legacy-base-url=${options.legacyBaseUrl}`);
		await runNodeScript("service/cli/backfill-hub-files.js", backfillArgs);
	}

	await initDb();
	const db = getDb();
	if (!db.files) {
		throw new Error("sqlite-hub-client files API unavailable. Install sqlite-hub-client@0.8.0+");
	}

	let status = await getStatus(db);
	console.log("[files-doctor] status", JSON.stringify(status, null, 2));

	if (options.cleanup) {
		console.log(`[files-doctor] Cleanup enabled (${options.dryRun ? "dry-run" : "apply"}).`);
		const cleanup = await cleanupUnreferenced(db, status.unreferenced_ids, options.dryRun);
		console.log("[files-doctor] cleanup", JSON.stringify(cleanup, null, 2));

		status = await getStatus(db);
		console.log("[files-doctor] post-cleanup status", JSON.stringify(status, null, 2));
	}
}

main().catch((err) => {
	console.error("[files-doctor] fatal:", err);
	process.exit(1);
});
