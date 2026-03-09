// service/store/publish-jobs.js
// CRUD for the publish_jobs table.
// A publish job is one post × one platform × one scheduled time.
import { getDb } from "../core/db.js";

function generateId() {
	return `pj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Create a new publish job.
 * @param {{
 *   postId: string,
 *   platformKey: string,
 *   mode: 'scheduled'|'manual',
 *   scheduledAt: number,          // unix ms — already resolved (even for random mode)
 *   windowStart?: string|null,    // "HH:MM" stored for display; null for fixed mode
 *   windowEnd?: string|null,      // "HH:MM" stored for display; null for fixed mode
 *   payload?: object|null,        // platform-specific overrides
 *   accountId?: string|null,
 * }} opts
 * @returns {Promise<string>} job ID
 */
export async function createPublishJob({ postId, platformKey, mode, scheduledAt, windowStart, windowEnd, payload, accountId }) {
	const db = getDb();
	const id = generateId();
	const now = Date.now();

	await db.insert("publish_jobs", {
		id,
		post_id: postId,
		platform_key: platformKey,
		account_id: accountId || null,
		status: "pending",
		mode: mode || "scheduled",
		scheduled_at: scheduledAt,
		random_window_start: windowStart || null,
		random_window_end: windowEnd || null,
		payload: payload ? JSON.stringify(payload) : null,
		error: null,
		platform_post_id: null,
		posted_at: null,
		created_at: now,
		updated_at: now,
	});

	return id;
}

/**
 * Get a publish job by its ID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getPublishJob(id) {
	const db = getDb();
	const rows = await db.find("publish_jobs", { id });
	return rows?.[0] || null;
}

/**
 * List publish jobs with optional filters.
 * @param {{ postId?: string, platformKey?: string, status?: string }} filter
 * @param {{ orderBy?: string, order?: string }} opts
 * @returns {Promise<Array>}
 */
export async function listPublishJobs(filter = {}, opts = {}) {
	const db = getDb();
	const where = {};
	if (filter.postId) where.post_id = filter.postId;
	if (filter.platformKey) where.platform_key = filter.platformKey;
	if (filter.status) where.status = filter.status;

	return db.find(
		"publish_jobs",
		Object.keys(where).length ? where : undefined,
		{ orderBy: opts.orderBy || "scheduled_at", order: opts.order || "ASC" }
	);
}

/**
 * Get all pending jobs whose scheduled_at is <= now.
 * @returns {Promise<Array>}
 */
export async function getPublishJobsDue() {
	const db = getDb();
	const now = Date.now();
	const pending = await db.find(
		"publish_jobs",
		{ status: "pending" },
		{ orderBy: "scheduled_at", order: "ASC" }
	);
	return pending.filter((j) => j.scheduled_at && j.scheduled_at <= now);
}

/**
 * Update the status (and optionally error) of a publish job.
 * @param {string} id
 * @param {string} status
 * @param {string|null} [error]
 */
export async function updatePublishJobStatus(id, status, error = null) {
	const db = getDb();
	const updates = { status, updated_at: Date.now() };
	if (error !== null) updates.error = error;
	await db.update("publish_jobs", updates, { id });
}

/**
 * Mark a publish job as successfully posted.
 * @param {string} id
 * @param {string} platformPostId - ID returned by the platform after posting
 */
export async function markPublishJobPosted(id, platformPostId) {
	const db = getDb();
	const now = Date.now();
	await db.update(
		"publish_jobs",
		{
			status: "posted",
			platform_post_id: platformPostId,
			posted_at: now,
			error: null,
			updated_at: now,
		},
		{ id }
	);
}

/**
 * Mark a publish job as permanently failed.
 * @param {string} id
 * @param {string} errorMessage
 */
export async function markPublishJobFailed(id, errorMessage) {
	const db = getDb();
	await db.update(
		"publish_jobs",
		{ status: "failed", error: errorMessage, updated_at: Date.now() },
		{ id }
	);
}

/**
 * Cancel a pending publish job (terminal; will not be retried).
 * @param {string} id
 */
export async function cancelPublishJob(id) {
	const db = getDb();
	await db.update("publish_jobs", { status: "cancelled", updated_at: Date.now() }, { id });
}

/**
 * Hard-delete a publish job record.
 * @param {string} id
 */
export async function deletePublishJob(id) {
	const db = getDb();
	await db.delete("publish_jobs", { id });
}

/**
 * Cancel all pending publish jobs for a given post across all platforms.
 * @param {string} postId
 */
export async function cancelPublishJobsForPost(postId) {
	const db = getDb();
	const rows = await db.find("publish_jobs", { post_id: postId, status: "pending" });
	for (const row of rows) {
		await db.update("publish_jobs", { status: "cancelled", updated_at: Date.now() }, { id: row.id });
	}
}
