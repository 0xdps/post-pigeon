// service/server.js
import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import { createPostsRouter } from "./routes/posts.js";
import { createImagesRouter } from "./routes/images.js";
import { createPlatformsRouter } from "./routes/platforms.js";
import { createScheduleRouter } from "./routes/schedule.js";
import { createClient } from "../posting/twitter-client.js";
import config from "../core/config.js";

export function createApp() {
	const app = new Hono();

	// ── Unauthenticated ───────────────────────────────────────────────────────
	app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));
	app.route("/api/auth", authRoutes);

	// ── Protected API ─────────────────────────────────────────────────────────
	const api = new Hono();
	api.use("*", authMiddleware);

	// Settings
	api.get("/settings", async (c) => {
		const settings = await config.getAllSettings();
		return c.json(settings);
	});

	api.patch("/settings", async (c) => {
		let body;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		await config.updateSettings(body);
		return c.json({ ok: true });
	});

	// Twitter health check (auth + API availability)
	api.get("/twitter/health", async (c) => {
		try {
			const client = createClient();
			const res = await client.v2.me();
			return c.json({
				ok: true,
				status: "ok",
				user: {
					id: res?.data?.id,
					username: res?.data?.username,
				},
				ts: Date.now(),
			});
		} catch (err) {
			const code = Number(err?.code || err?.status || err?.statusCode || err?.data?.status);
			const title = err?.data?.title || err?.title || "Request failed";
			const detail = err?.data?.detail || err?.message || "No detail available";
			const type = err?.data?.type || err?.type || "unknown";

			if (code === 401 || code === 403) {
				return c.json(
					{
						ok: false,
						status: "auth_error",
						code,
						title,
						detail,
						type,
						ts: Date.now(),
					},
					200
				);
			}

			if (code === 429 || code === 502 || code === 503 || code === 504) {
				return c.json(
					{
						ok: false,
						status: "service_unavailable",
						code,
						title,
						detail,
						type,
						ts: Date.now(),
					},
					200
				);
			}

			return c.json(
				{
					ok: false,
					status: "unknown_error",
					code: Number.isFinite(code) ? code : null,
					title,
					detail,
					type,
					ts: Date.now(),
				},
				200
			);
		}
	});

	// Dynamic Posts
	api.route("/posts", createPostsRouter());
	api.route("/posts", createImagesRouter());
	api.route("/platforms", createPlatformsRouter());

	// Publish jobs — schedule a post to one or more platforms
	api.route("/schedule", createScheduleRouter());

	app.route("/api", api);


	return app;
}
