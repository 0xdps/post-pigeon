import "dotenv/config";
import { serve } from "@hono/node-server";
import { initDb } from "./core/db.js";
import { createApp } from "./http/server.js";
import { startScheduler } from "./posting/scheduler.js";
import { seedPlatformsIfMissing, syncPlatformCredentialsFromEnv } from "./store/platform-store.js";

const PORT = Number(process.env.PORT) || 3000;

async function main() {
	console.log("Starting posthub...");
	console.log(`  SQLITE_HUB_URL:  ${process.env.SQLITE_HUB_URL ?? "(not set)"}`);
	console.log(`  SQLITE_HUB_DB:   ${process.env.SQLITE_HUB_DB ?? "(not set)"}`);
	console.log(`  CRON_ENABLED:    ${process.env.CRON_ENABLED ?? "true (default)"}`);
	console.log(`  DRY_RUN:         ${process.env.DRY_RUN ?? "false (default)"}`);
	console.log(`  PORT:            ${PORT}`);

	console.log("Connecting to SQLite Hub...");
	if (process.env.DISABLE_DB === "true") {
		console.warn("⚠️  DISABLE_DB=true — skipping DB init (debug mode, posting will not work)");
	} else {
		try {
			await initDb();
			await seedPlatformsIfMissing();
			await syncPlatformCredentialsFromEnv();
			console.log("SQLite Hub connected and tables ready.");
		} catch (err) {
			console.error("Failed to connect to SQLite Hub:", err.message);
			console.error("  URL used:", process.env.SQLITE_HUB_URL);
			throw err;
		}
	}

	const app = createApp();

	serve({ fetch: app.fetch, port: PORT }, () => {
		console.log(`Server running on http://0.0.0.0:${PORT}`);
	});

	await startScheduler();
}

main().catch((err) => {
	console.error("Fatal startup error:", err);
	process.exit(1);
});
