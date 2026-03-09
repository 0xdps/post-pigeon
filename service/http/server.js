// service/server.js
import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import { createPostsRouter } from "./routes/posts.js";
import { createImagesRouter } from "./routes/images.js";
import { createPlatformsRouter } from "./routes/platforms.js";
import { createScheduleRouter } from "./routes/schedule.js";
import { getDb } from "../core/db.js";
import { loadState, appendPosted, removePosted, getPostsToday, getTotalPostedCount, removeQueueEntriesForItem } from "../store/state-store.js";
import { preparePost, postTweet } from "../posting/post-utils.js";
import { listPostImages, loadBankFromDb, getBankItemFromDb } from "../store/db-posts.js";
import { createClient, deleteStatus } from "../posting/twitter-client.js";
import run from "../posting/poster.js";
import config from "../core/config.js";
import {
	createScheduledPost,
	getScheduledPosts,
	getScheduledPostsDue,
	markScheduledPostAsPosted,
	markScheduledPostAsFailed,
	cancelScheduledPost,
	cancelScheduledPostsForItem,
	deleteScheduledPost,
} from "../store/scheduled-posts.js";

export function createApp() {
	const app = new Hono();

	// ── Unauthenticated ───────────────────────────────────────────────────────
	app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));
	app.route("/api/auth", authRoutes);

	// ── Protected API ─────────────────────────────────────────────────────────
	const api = new Hono();
	api.use("*", authMiddleware);

	// State
	api.get("/state", async (c) => {
		const [state, total_posts] = await Promise.all([loadState(), getTotalPostedCount()]);
		const paused = await config.isPaused();
		const cooldownUntil = await config.getCooldownUntil();
		const cooldownActive = cooldownUntil && Date.now() < cooldownUntil;
		return c.json({
			...state,
			total_posts,
			paused,
			cooldownActive: !!cooldownActive,
			cooldownUntil: cooldownActive ? cooldownUntil : null,
		});
	});

	// Posted history
	api.get("/posted", async (c) => {
		const { posted } = await loadState();
		return c.json(posted);
	});

	// Bank — returns file IDs only; FE fetches content directly with auth
	async function enrichBankItem(item) {
		try {
			const postId = `bank-${String(item.id)}`;
			const images = await listPostImages(postId);
			return {
				...item,
				// text_file_id is already on item from loadBankFromDb / getBankItemFromDb
				images: images.map((img) => ({
					id: img.id,
					file_id: img.file_path,
					filename: img.filename,
					mime_type: img.mime_type,
				})),
			};
		} catch {
			return item;
		}
	}

	api.get("/bank", async (c) => {
		const bank = await loadBankFromDb();
		const enriched = await Promise.all(bank.map(enrichBankItem));
		return c.json({
			success: true,
			count: enriched.length,
			items: enriched,
		});
	});

	api.get("/bank/:id", async (c) => {
		const item = await getBankItemFromDb(c.req.param("id"));
		if (!item) return c.json({ success: false, error: "Not found" }, 404);
		const enriched = await enrichBankItem(item);
		return c.json({
			success: true,
			post: enriched,
		});
	});

	// Queue
	api.get("/queue", async (c) => {
		const db = getDb();
		const items = await db.find("queued", undefined, { orderBy: "created_at", order: "ASC" });
		return c.json(items);
	});

	api.post("/queue", async (c) => {
		let body;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		const { local_id } = body;
		if (!local_id) return c.json({ error: "local_id required" }, 400);
		const db = getDb();
		const { lastInsertRowid } = await db.insert("queued", { local_id, created_at: Date.now() });
		return c.json({ id: lastInsertRowid, local_id });
	});

	api.delete("/queue/:id", async (c) => {
		const db = getDb();
		await db.delete("queued", { id: Number(c.req.param("id")) });
		return c.json({ ok: true });
	});

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

	// Trigger — manual override, bypasses probability + cooldown + window
	api.post("/trigger", async (c) => {
		let body = {};
		try { body = await c.req.json(); } catch { /* no body is fine */ }
		const force = !!body?.force;
		try {
			const result = await run({ manual: true, force });
			return c.json(result);
		} catch (err) {
			console.error("/trigger error:", err);
			return c.json({ error: err.message }, 500);
		}
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

	// Post specific bank item immediately
	api.post("/post/:id", async (c) => {
		const item = await getBankItemFromDb(c.req.param("id"));
		if (!item) return c.json({ error: "Bank item not found" }, 404);

		let body = {};
		try { body = await c.req.json(); } catch { /* no body is fine */ }
		const force = !!body?.force;

		// Daily limit check with optional override
		const DAILY_LIMIT = await config.getDailyLimit();
		const postsToday = await getPostsToday();
		if (postsToday >= DAILY_LIMIT) {
			if (force) {
				const overrideAllowed = await config.getManualLimitOverride();
				if (!overrideAllowed) {
					return c.json({ skipped: true, reason: "limit", postsToday, limit: DAILY_LIMIT }, 200);
				}
			} else {
				return c.json({ skipped: true, reason: "limit", postsToday, limit: DAILY_LIMIT }, 200);
			}
		}

		try {
			const { text, mediaIds, client } = await preparePost(item, 0);
			const tweetId = await postTweet(text, mediaIds, client);
			await appendPosted({ localId: item.id, tweetId, ts: Date.now(), triggerType: "manual" });
			// Remove from queue + cancel pending scheduled posts for this item
			await removeQueueEntriesForItem(item.id);
			await cancelScheduledPostsForItem(item.id);
			return c.json({ tweetId, localId: item.id });
		} catch (err) {
			console.error("/post/:id error:", err);
			return c.json({ error: err.message }, 500);
		}
	});
		// Delete a tweet
	api.delete("/post/:id", async (c) => {
		const { posted } = await loadState();
		const entry = posted.find((p) => String(p.localId) === c.req.param("id"));
		if (!entry) return c.json({ error: "Not found in posted history" }, 404);
		try {
			const client = createClient();
			await deleteStatus(client, entry.tweetId);
			await removePosted(entry.localId);
			return c.json({ deleted: true, tweetId: entry.tweetId });
		} catch (err) {
			console.error("/post/:id DELETE error:", err);
			return c.json({ error: err.message }, 500);
		}
	});

	// Scheduled Posts
	api.get("/scheduled", async (c) => {
		const posts = await getScheduledPosts();
		return c.json(posts);
	});

	api.post("/scheduled", async (c) => {
		let body;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		const { local_id, scheduled_at } = body;
		if (!local_id || !scheduled_at) {
			return c.json({ error: "local_id and scheduled_at required" }, 400);
		}
		if (typeof scheduled_at !== "number" || scheduled_at <= Date.now()) {
			return c.json({ error: "scheduled_at must be a future timestamp in milliseconds" }, 400);
		}
		try {
			const id = await createScheduledPost(local_id, scheduled_at);
			return c.json({ id, local_id, scheduled_at, status: "pending" });
		} catch (err) {
			console.error("/scheduled POST error:", err);
			return c.json({ error: err.message }, 500);
		}
	});

	api.delete("/scheduled/:id", async (c) => {
		try {
			const id = Number(c.req.param("id"));
			await deleteScheduledPost(id);
			return c.json({ ok: true });
		} catch (err) {
			console.error("/scheduled/:id DELETE error:", err);
			return c.json({ error: err.message }, 500);
		}
	});

	api.patch("/scheduled/:id/cancel", async (c) => {
		try {
			const id = Number(c.req.param("id"));
			await cancelScheduledPost(id);
			return c.json({ ok: true });
		} catch (err) {
			console.error("/scheduled/:id/cancel error:", err);
			return c.json({ error: err.message }, 500);
		}
	});

	// Dynamic Posts (new system)
	api.route("/posts", createPostsRouter());
	api.route("/posts", createImagesRouter());
	api.route("/platforms", createPlatformsRouter());

	// Publish jobs — schedule a post to one or more platforms
	api.route("/schedule", createScheduleRouter());

	app.route("/api", api);


	return app;
}
