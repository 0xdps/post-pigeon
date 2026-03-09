// service/http/routes/schedule.js
// API routes for creating and managing publish jobs (post × platform × time).
import { Hono } from "hono";
import {
	createPublishJob,
	getPublishJob,
	listPublishJobs,
	cancelPublishJob,
	deletePublishJob,
	updatePublishJobStatus,
	markPublishJobPosted,
	markPublishJobFailed,
} from "../../store/publish-jobs.js";
import { getAdapter } from "../../platforms/registry.js";
import { getPost, updatePost } from "../../store/db-posts.js";
import config from "../../core/config.js";

/**
 * Resolve the scheduled_at timestamp from user-supplied schedule options.
 *
 * mode='fixed'  → scheduledAt is used directly (must be a future unix-ms value)
 * mode='random' → a random time is picked within [windowStart, windowEnd] today
 *                 (or tomorrow if today's window has already closed).
 *                 The picked time is committed immediately — no runtime randomness.
 *
 * windowStart / windowEnd are "HH:MM" strings interpreted in the server's local time.
 * (If server timezone != configured timezone, use the timezone param for Intl formatting.)
 */
function resolveScheduledAt({ mode, scheduledAt, windowStart, windowEnd }, timezone) {
	if (mode === "fixed") {
		if (!scheduledAt || typeof scheduledAt !== "number") {
			throw new Error("scheduledAt (unix ms) is required for fixed mode");
		}
		if (scheduledAt <= Date.now()) {
			throw new Error("scheduledAt must be a future timestamp");
		}
		return scheduledAt;
	}

	if (mode === "random") {
		if (!windowStart || !windowEnd) {
			throw new Error("windowStart and windowEnd (HH:MM) are required for random mode");
		}

		const [startH, startM] = windowStart.split(":").map(Number);
		const [endH, endM] = windowEnd.split(":").map(Number);

		if ([startH, startM, endH, endM].some((n) => !Number.isFinite(n))) {
			throw new Error("windowStart and windowEnd must be valid HH:MM strings");
		}

		// Determine today's date components in the configured timezone
		const now = new Date();
		const formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		const [yyyy, mm, dd] = formatter.format(now).split("-").map(Number);

		// Build epoch-ms for today's window using Date (interpreted in server local time)
		const todayStart = new Date(yyyy, mm - 1, dd, startH, startM, 0, 0).getTime();
		const todayEnd = new Date(yyyy, mm - 1, dd, endH, endM, 0, 0).getTime();

		const MS_PER_DAY = 86_400_000;
		const minFuture = now.getTime() + 60_000; // at least 1 minute from now

		let lo = Math.max(minFuture, todayStart);
		let hi = todayEnd;

		if (lo >= hi) {
			// Today's window has fully passed — shift to tomorrow
			lo = todayStart + MS_PER_DAY;
			hi = todayEnd + MS_PER_DAY;
		}

		return lo + Math.floor(Math.random() * (hi - lo));
	}

	throw new Error(`Unknown mode '${mode}'. Use 'fixed' or 'random'.`);
}

export function createScheduleRouter() {
	const router = new Hono();

	/**
	 * POST /api/schedule
	 * Create publish jobs for a post across one or more platforms.
	 *
	 * Body:
	 * {
	 *   post_id: string,
	 *   platforms: [
	 *     {
	 *       key: string,              // platform key, e.g. "twitter"
	 *       mode: 'fixed'|'random',
	 *       scheduled_at?: number,   // unix ms; required for fixed mode
	 *       window_start?: string,   // "HH:MM"; required for random mode
	 *       window_end?: string,     // "HH:MM"; required for random mode
	 *       payload?: object,        // optional platform-specific overrides
	 *     },
	 *     ...
	 *   ]
	 * }
	 */
	router.post("/", async (c) => {
		try {
			const body = await c.req.json();
			const { post_id, platforms } = body;

			if (!post_id) return c.json({ success: false, error: "post_id is required" }, 400);
			if (!Array.isArray(platforms) || platforms.length === 0) {
				return c.json({ success: false, error: "platforms array is required and must not be empty" }, 400);
			}

			const post = await getPost(post_id);
			if (!post) return c.json({ success: false, error: "Post not found" }, 404);

			const timezone = await config.getTimezone();
			const created = [];

			for (const platform of platforms) {
				const { key, mode = "fixed", scheduled_at, window_start, window_end, payload } = platform;

				if (!key) return c.json({ success: false, error: "platform.key is required" }, 400);

				let resolvedAt;
				try {
					resolvedAt = resolveScheduledAt(
						{ mode, scheduledAt: scheduled_at, windowStart: window_start, windowEnd: window_end },
						timezone
					);
				} catch (err) {
					return c.json({ success: false, error: `Platform '${key}': ${err.message}` }, 400);
				}

				const jobId = await createPublishJob({
					postId: post_id,
					platformKey: key,
					mode,
					scheduledAt: resolvedAt,
					windowStart: window_start || null,
					windowEnd: window_end || null,
					payload: payload || null,
				});

				created.push({ platform_key: key, job_id: jobId, scheduled_at: resolvedAt });
			}

			return c.json({ success: true, jobs: created }, 201);
		} catch (err) {
			console.error("POST /schedule error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * GET /api/schedule
	 * List publish jobs with optional filters.
	 * Query params: ?post_id=&platform_key=&status=
	 */
	router.get("/", async (c) => {
		try {
			const filter = {
				postId: c.req.query("post_id") || undefined,
				platformKey: c.req.query("platform_key") || undefined,
				status: c.req.query("status") || undefined,
			};
			const jobs = await listPublishJobs(filter);
			return c.json({ success: true, count: jobs.length, jobs });
		} catch (err) {
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * GET /api/schedule/:id
	 * Get a single publish job.
	 */
	router.get("/:id", async (c) => {
		try {
			const job = await getPublishJob(c.req.param("id"));
			if (!job) return c.json({ success: false, error: "Job not found" }, 404);
			return c.json({ success: true, job });
		} catch (err) {
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * DELETE /api/schedule/:id
	 * Cancel a pending publish job. Only pending jobs can be cancelled.
	 */
	router.delete("/:id", async (c) => {
		try {
			const job = await getPublishJob(c.req.param("id"));
			if (!job) return c.json({ success: false, error: "Job not found" }, 404);
			if (job.status !== "pending") {
				return c.json(
					{ success: false, error: `Cannot cancel a job with status '${job.status}'` },
					400
				);
			}
			await cancelPublishJob(c.req.param("id"));
			return c.json({ success: true });
		} catch (err) {
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * POST /api/schedule/:id/publish
	 * Manually publish a pending job immediately, bypassing its scheduled_at time.
	 */
	router.post("/:id/publish", async (c) => {
		try {
			const job = await getPublishJob(c.req.param("id"));
			if (!job) return c.json({ success: false, error: "Job not found" }, 404);
			if (job.status !== "pending") {
				return c.json({ success: false, error: `Job is already '${job.status}'` }, 400);
			}

			const adapter = getAdapter(job.platform_key);
			if (!adapter) {
				return c.json(
					{ success: false, error: `No adapter registered for platform '${job.platform_key}'` },
					400
				);
			}

			await updatePublishJobStatus(job.id, "processing");

			try {
				const payload = job.payload ? JSON.parse(job.payload) : {};
				const dryRun = await config.isDryRun();
				const result = await adapter.post(job.post_id, { payloadOverrides: payload, dryRun });
				await markPublishJobPosted(job.id, result.platformPostId);
				await updatePost(job.post_id, { status: "posted" });
				return c.json({ success: true, platform_post_id: result.platformPostId, url: result.url });
			} catch (err) {
				await markPublishJobFailed(job.id, err.message);
				return c.json({ success: false, error: err.message }, 500);
			}
		} catch (err) {
			console.error("POST /schedule/:id/publish error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	return router;
}
