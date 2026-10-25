import { initDb } from "../../service/core/db.js";
import { seedPlatformsIfMissing, syncPlatformCredentialsFromEnv } from "../../service/store/platform-store.js";
import { startScheduler } from "../../service/posting/scheduler.js";

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
	await startScheduler();
	console.log("PostPigeon ready.");
}
