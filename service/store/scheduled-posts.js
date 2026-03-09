// service/scheduled-posts.js
import { getDb } from "../core/db.js";

/**
 * Create a scheduled post
 */
export async function createScheduledPost(localId, scheduledAt) {
	const db = getDb();
	const { lastInsertRowid } = await db.insert("scheduled", {
		local_id: localId,
		scheduled_at: scheduledAt,
		status: "pending",
		created_at: Date.now(),
	});
	return lastInsertRowid;
}

/**
 * Get all scheduled posts
 */
export async function getScheduledPosts() {
	const db = getDb();
	return await db.find("scheduled", undefined, { orderBy: "scheduled_at", order: "ASC" });
}

/**
 * Get local_ids of all pending scheduled posts (not yet due/posted/cancelled)
 */
export async function getPendingScheduledLocalIds() {
	const db = getDb();
	const rows = await db.find("scheduled", { status: "pending" }, { columns: ["local_id"] });
	return new Set(rows.map((r) => String(r.local_id)));
}

/**
 * Get scheduled posts that are due (scheduled_at <= now and status = pending)
 */
export async function getScheduledPostsDue() {
	const db = getDb();
	const now = Date.now();
	// SQLite doesn't support >= in simple where clause, so fetch all pending and filter
	const pending = await db.find("scheduled", { status: "pending" }, { orderBy: "scheduled_at", order: "ASC" });
	return pending.filter((p) => p.scheduled_at <= now);
}

/**
 * Update scheduled post status after posting
 */
export async function markScheduledPostAsPosted(id, tweetId) {
	const db = getDb();
	await db.update(
		"scheduled",
		{ status: "posted", posted_at: Date.now(), tweet_id: tweetId, error: null },
		{ id }
	);
}

/**
 * Mark scheduled post as failed (terminal — won't be retried)
 */
export async function markScheduledPostAsFailed(id, errorMessage) {
	const db = getDb();
	await db.update("scheduled", { status: "failed", error: errorMessage }, { id });
}

/**
 * Record a failed attempt without changing status.
 * Keeps the post as "pending" so the scheduler retries it next run.
 */
export async function recordScheduledPostError(id, errorMessage) {
	const db = getDb();
	await db.update("scheduled", { error: errorMessage }, { id });
}

/**
 * Cancel a scheduled post
 */
export async function cancelScheduledPost(id) {
	const db = getDb();
	await db.update("scheduled", { status: "cancelled" }, { id });
}

/**
 * Cancel all pending scheduled posts for a given bank item
 */
export async function cancelScheduledPostsForItem(localId) {
	const db = getDb();
	const rows = await db.find("scheduled", { local_id: String(localId) });
	const pending = rows.filter((r) => r.status === "pending");
	for (const post of pending) {
		await db.update("scheduled", { status: "cancelled" }, { id: post.id });
	}
}

/**
 * Delete a scheduled post
 */
export async function deleteScheduledPost(id) {
	const db = getDb();
	await db.delete("scheduled", { id });
}

/**
 * Get a specific scheduled post
 */
export async function getScheduledPost(id) {
	const db = getDb();
	const result = await db.find("scheduled", { id });
	return result?.[0];
}
