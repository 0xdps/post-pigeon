export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;

	const serviceUrl = (path) => `file://${process.cwd()}/${path}`;
	const { initDb } = await import(/* webpackIgnore: true */ serviceUrl("service/core/db.js"));
	const { seedPlatformsIfMissing, syncPlatformCredentialsFromEnv } = await import(
		/* webpackIgnore: true */ serviceUrl("service/store/platform-store.js")
	);
	const { startScheduler } = await import(/* webpackIgnore: true */ serviceUrl("service/posting/scheduler.js"));
	const { createClient } = await import(/* webpackIgnore: true */ serviceUrl("service/posting/twitter-client.js"));

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
