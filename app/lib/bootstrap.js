import { initDb } from "../../service/core/db.js";
import { seedPlatformsIfMissing, syncPlatformCredentialsFromEnv } from "../../service/store/platform-store.js";
import { startScheduler } from "../../service/posting/scheduler.js";
import { createClient } from "../../service/posting/twitter-client.js";

let started = null;

export function ensureServerStarted() {
	if (!started) {
		started = boot().catch((err) => {
			started = null;
			throw err;
		});
	}
	return started;
}

async function boot() {
	if (process.env.DISABLE_DB === "true") {
		console.warn("DISABLE_DB=true — skipping MesaHub init and scheduler");
		return;
	}

	await initDb();
	await seedPlatformsIfMissing();
	await syncPlatformCredentialsFromEnv();
	if (process.env.TWITTER_ACCESS_REFRESH_TOKEN || process.env.TWIITER_ACCESS_REFRESH_TOKEN) {
		try {
			await createClient();
			console.log("[twitter] Access token refreshed");
		} catch (err) {
			console.error("[twitter] Access token refresh failed:", err?.data?.error_description || err.message);
		}
	}
	await startScheduler();
	console.log("PostPigeon ready.");
}
