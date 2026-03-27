// service/scheduler.js
import cron from "node-cron";
import config from "../core/config.js";
import { getPublishJobsDue, updatePublishJobStatus, markPublishJobPosted, markPublishJobFailed } from "../store/publish-jobs.js";
import { getAdapter } from "../platforms/registry.js";
import { updatePost } from "../store/db-posts.js";

let _currentTask = null;

/**
 * Execute all publish_jobs that are due — dispatches to the correct platform adapter.
 * This is the new multi-platform execution path.
 */
async function checkPublishJobs() {
	try {
		const dueJobs = await getPublishJobsDue();
		if (dueJobs.length === 0) return;

		console.log(`[publish-jobs] Found ${dueJobs.length} due job(s), executing...`);

		const paused = await config.isPaused();
		if (paused) {
			console.log("[publish-jobs] Posting is paused — skipping all due jobs this tick.");
			return;
		}

		for (const job of dueJobs) {
			console.log(`[publish-jobs] Executing job ${job.id} → ${job.platform_key} for post ${job.post_id}`);

			const adapter = getAdapter(job.platform_key);
			if (!adapter) {
				await markPublishJobFailed(job.id, `No adapter registered for platform '${job.platform_key}'`);
				console.error(`[publish-jobs] No adapter for '${job.platform_key}', marking failed.`);
				continue;
			}

			// Mark as processing before attempting so a second tick won't re-fire this job
			await updatePublishJobStatus(job.id, "processing");

			try {
				const payload = job.payload ? JSON.parse(job.payload) : {};
				const dryRun = await config.isDryRun();
				const result = await adapter.post(job.post_id, { payloadOverrides: payload, dryRun });
				await markPublishJobPosted(job.id, result.platformPostId);
				await updatePost(job.post_id, { status: "posted" });
				console.log(`[publish-jobs] Job ${job.id} posted — platformPostId=${result.platformPostId}`);
			} catch (err) {
				await markPublishJobFailed(job.id, err.message);
				console.error(`[publish-jobs] Job ${job.id} failed:`, err.message);
			}
		}
	} catch (err) {
		console.error("[publish-jobs] Error checking publish jobs:", err);
	}
}

export async function startScheduler() {
	if (!(await config.isCronEnabled())) {
		console.log("Scheduler disabled via cron_enabled setting. Cron will not run.");
		return;
	}

	// Per-minute tick: check publish_jobs
	_currentTask = cron.schedule("*/1 * * * *", async () => {
		await checkPublishJobs();
	});

	console.log("Scheduler started — publish jobs checked every minute.");
}

/**
 * Stop the current scheduler (useful for testing or manual control)
 */
export function stopScheduler() {
	if (_currentTask) {
		_currentTask.stop();
		console.log("Scheduler stopped.");
	}
}
