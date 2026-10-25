export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;

	const serviceUrl = (path) => `file://${process.cwd()}/${path}`;
	const { initDb } = await import(/* webpackIgnore: true */ serviceUrl("service/core/db.js"));
	const { seedPlatformsIfMissing, syncPlatformCredentialsFromEnv } = await import(
		/* webpackIgnore: true */ serviceUrl("service/store/platform-store.js")
	);
	const { startScheduler } = await import(/* webpackIgnore: true */ serviceUrl("service/posting/scheduler.js"));

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
