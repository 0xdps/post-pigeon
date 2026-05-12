import "dotenv/config";
import { serve } from "@hono/node-server";
import { initDb } from "./core/db.js";
import { createApp } from "./http/server.js";
import { startScheduler } from "./posting/scheduler.js";
import { seedPlatformsIfMissing, syncPlatformCredentialsFromEnv } from "./store/platform-store.js";

const PORT = Number(process.env.PORT) || 3000;

async function main() {
	console.log("Starting postpigeon...");
	console.log(`  MESAHUB_URL:     ${process.env.MESAHUB_URL ? process.env.MESAHUB_URL.replace(/shs_[^@]+/, 'shs_***') : "(not set)"}`);
	console.log(`  CRON_ENABLED:    ${process.env.CRON_ENABLED ?? "true (default)"}`);
	console.log(`  DRY_RUN:         ${process.env.DRY_RUN ?? "false (default)"}`);
	console.log(`  PORT:            ${PORT}`);

			console.log("Connecting to MesaHub...");
	if (process.env.DISABLE_DB === "true") {
		console.warn("⚠️  DISABLE_DB=true — skipping DB init (debug mode, posting will not work)");
	} else {
		try {
			await initDb();
			await seedPlatformsIfMissing();
			await syncPlatformCredentialsFromEnv();
			console.log("MesaHub connected and tables ready.");
		} catch (err) {
			console.error("Failed to connect to MesaHub:", err.message);
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
