import {
	createPublishJob,
	getPublishJob,
	listPublishJobs,
	cancelPublishJob,
	updatePublishJobStatus,
	markPublishJobPosted,
	markPublishJobFailed,
} from "../../service/store/publish-jobs.js";
import { getAdapter } from "../../service/platforms/registry.js";
import { getPost, updatePost } from "../../service/store/db-posts.js";
import config from "../../service/core/config.js";
import { json } from "./http.js";

function resolveScheduledAt({ mode, scheduledAt, windowStart, windowEnd }, timezone) {
	if (mode === "fixed") {
		if (!scheduledAt || typeof scheduledAt !== "number") throw new Error("scheduledAt (unix ms) is required for fixed mode");
		if (scheduledAt <= Date.now()) throw new Error("scheduledAt must be a future timestamp");
		return scheduledAt;
	}
	if (mode !== "random") throw new Error(`Unknown mode '${mode}'. Use 'fixed' or 'random'.`);
	if (!windowStart || !windowEnd) throw new Error("windowStart and windowEnd (HH:MM) are required for random mode");

	const [startH, startM] = windowStart.split(":").map(Number);
	const [endH, endM] = windowEnd.split(":").map(Number);
	if ([startH, startM, endH, endM].some((n) => !Number.isFinite(n))) {
		throw new Error("windowStart and windowEnd must be valid HH:MM strings");
	}

	const now = new Date();
	const [yyyy, mm, dd] = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	})
		.format(now)
		.split("-")
		.map(Number);

	const todayStart = new Date(yyyy, mm - 1, dd, startH, startM, 0, 0).getTime();
	const todayEnd = new Date(yyyy, mm - 1, dd, endH, endM, 0, 0).getTime();
	const minFuture = now.getTime() + 60_000;
	let lo = Math.max(minFuture, todayStart);
	let hi = todayEnd;
	if (lo >= hi) {
		lo = todayStart + 86_400_000;
		hi = todayEnd + 86_400_000;
	}
	return lo + Math.floor(Math.random() * (hi - lo));
}

export async function createScheduleResponse(body) {
	try {
		const { post_id, platforms } = body || {};
		if (!post_id) return json({ success: false, error: "post_id is required" }, 400);
		if (!Array.isArray(platforms) || !platforms.length) {
			return json({ success: false, error: "platforms array is required and must not be empty" }, 400);
		}
		const post = await getPost(post_id);
		if (!post) return json({ success: false, error: "Post not found" }, 404);

		const timezone = await config.getTimezone();
		const created = [];
		for (const platform of platforms) {
			const { key, mode = "fixed", scheduled_at, window_start, window_end, payload } = platform;
			if (!key) return json({ success: false, error: "platform.key is required" }, 400);
			let resolvedAt;
			try {
				resolvedAt = resolveScheduledAt(
					{ mode, scheduledAt: scheduled_at, windowStart: window_start, windowEnd: window_end },
					timezone
				);
			} catch (err) {
				return json({ success: false, error: `Platform '${key}': ${err.message}` }, 400);
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
		return json({ success: true, jobs: created }, 201);
	} catch (err) {
		console.error("POST /schedule error:", err);
		return json({ success: false, error: err.message }, 500);
	}
}

export async function listScheduleResponse(request) {
	try {
		const params = request.nextUrl.searchParams;
		const jobs = await listPublishJobs({
			postId: params.get("post_id") || undefined,
			platformKey: params.get("platform_key") || undefined,
			status: params.get("status") || undefined,
		});
		return json({ success: true, count: jobs.length, jobs });
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function getScheduleResponse(id) {
	try {
		const job = await getPublishJob(id);
		if (!job) return json({ success: false, error: "Job not found" }, 404);
		return json({ success: true, job });
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function cancelScheduleResponse(id) {
	try {
		const job = await getPublishJob(id);
		if (!job) return json({ success: false, error: "Job not found" }, 404);
		if (job.status !== "pending") return json({ success: false, error: `Cannot cancel a job with status '${job.status}'` }, 400);
		await cancelPublishJob(id);
		return json({ success: true });
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function publishNowResponse(id) {
	try {
		const job = await getPublishJob(id);
		if (!job) return json({ success: false, error: "Job not found" }, 404);
		if (job.status !== "pending") return json({ success: false, error: `Job is already '${job.status}'` }, 400);
		const adapter = getAdapter(job.platform_key);
		if (!adapter) return json({ success: false, error: `No adapter registered for platform '${job.platform_key}'` }, 400);

		await updatePublishJobStatus(job.id, "processing");
		try {
			const payload = job.payload ? JSON.parse(job.payload) : {};
			const result = await adapter.post(job.post_id, { payloadOverrides: payload });
			await markPublishJobPosted(job.id, result.platformPostId);
			await updatePost(job.post_id, { status: "posted" });
			return json({ success: true, platform_post_id: result.platformPostId, url: result.url });
		} catch (err) {
			await markPublishJobFailed(job.id, err.message);
			return json({ success: false, error: err.message }, 500);
		}
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}
