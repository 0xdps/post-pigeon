// service/scheduler.js
import cron from "node-cron";
import run from "./poster.js";
import config from "../core/config.js";
import { getScheduledPostsDue, markScheduledPostAsPosted, recordScheduledPostError } from "../store/scheduled-posts.js";
import { getPublishJobsDue, updatePublishJobStatus, markPublishJobPosted, markPublishJobFailed } from "../store/publish-jobs.js";
import { getAdapter } from "../platforms/registry.js";
import { preparePost, postTweet } from "./post-utils.js";
import { loadBankFromDb, updatePost } from "../store/db-posts.js";
import { appendPosted } from "../store/state-store.js";

let _currentTask = null;
let _scheduledPostsTask = null;

/**
 * Execute a single scheduled post
 */
async function executeScheduledPost(scheduledPost) {
	try {
		console.log(`[scheduled] Executing scheduled post ${scheduledPost.id} for ${scheduledPost.local_id}`);

		// Load bank from DB and find the item
		const bank = await loadBankFromDb();
		const item = bank.find((b) => String(b.id) === String(scheduledPost.local_id));
		if (!item) {
			throw new Error(`Bank item ${scheduledPost.local_id} not found`);
		}

		// Check if paused
		const paused = await config.isPaused();
		if (paused) {
			throw new Error("Posting is paused");
		}

		// Prepare and post
		const { text, mediaIds } = await preparePost(item, 0);
		const tweetId = await postTweet(text, mediaIds);

		// Mark as posted
		await markScheduledPostAsPosted(scheduledPost.id, tweetId);
		await appendPosted({ localId: item.id, tweetId, ts: Date.now(), triggerType: "scheduled" });
		console.log(`[scheduled] Posted tweet ${tweetId} for scheduled post ${scheduledPost.id}`);
	} catch (err) {
		console.error(`[scheduled] Failed to execute scheduled post ${scheduledPost.id}:`, err.message);
		try {
			// Keep status as "pending" so the scheduler retries — only record the error message
			await recordScheduledPostError(scheduledPost.id, err.message);
		} catch (markErr) {
			console.error(`[scheduled] Failed to record error:`, markErr);
		}
	}
}

/**
 * Check and execute due scheduled posts (legacy bank-based system)
 */
async function checkScheduledPosts() {
	try {
		const duePosts = await getScheduledPostsDue();
		if (duePosts.length > 0) {
			console.log(`[scheduled] Found ${duePosts.length} due posts, executing...`);
			for (const post of duePosts) {
				await executeScheduledPost(post);
			}
		}
	} catch (err) {
		console.error("[scheduled] Error checking scheduled posts:", err);
	}
}

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

	const schedule = await config.getCronSchedule();

	if (!cron.validate(schedule)) {
		console.error(`Invalid CRON_SCHEDULE: "${schedule}". Scheduler not started.`);
		return;
	}

	_currentTask = cron.schedule(schedule, async () => {
		console.log(`[cron] Firing at ${new Date().toISOString()}`);
		try {
			const result = await run();
			console.log("[cron] Result:", result);
		} catch (err) {
			console.error("[cron] Error:", err);
		}
	});

	console.log(`Scheduler started with schedule: "${schedule}"`);

	// Per-minute tick: check legacy scheduled posts AND new publish_jobs
	_scheduledPostsTask = cron.schedule("*/1 * * * *", async () => {
		await checkScheduledPosts();
		await checkPublishJobs();
	});

	console.log("Scheduled posts checker started (runs every minute)");
}

/**
 * Stop the current scheduler (useful for testing or manual control)
 */
export function stopScheduler() {
	if (_currentTask) {
		_currentTask.stop();
		console.log("Scheduler stopped.");
	}
	if (_scheduledPostsTask) {
		_scheduledPostsTask.stop();
		console.log("Scheduled posts checker stopped.");
	}
}
