import { getDb } from "../core/db.js";

// ── State (counter only — date/posts_today derived from history table) ─────────

export async function loadState() {
	const db = getDb();
	const rows = await db.find("config", undefined, { columns: ["key", "value"] });
	const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
	const posts_today = await getPostsToday();
	return {
		counter: Number(map.counter ?? 0),
		posts_today,
		posted: await loadPosted(),
	};
}

export async function saveState(state) {
	await upsertKv("counter", String(state.counter ?? 0));
}

// Returns total number of posts ever made (all history rows, including soft-deleted)
export async function getTotalPostedCount() {
	const db = getDb();
	return db.count("history");
}

// Returns count of posts made since midnight today (local time)
export async function getPostsToday() {
	const db = getDb();
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const rows = await db.find("history", undefined, { columns: ["ts"] });
	return rows.filter((r) => Number(r.ts) >= startOfDay.getTime()).length;
}

// ── Generic key-value helpers (used for state + settings) ───────────────────

async function upsertKv(key, value) {
	const db = getDb();
	// Use native UPSERT (INSERT OR REPLACE) — single atomic query
	await db.upsert("config", { key, value: String(value) });
}

/**
 * Load all settings in a single database query
 * Returns an object with key -> value mapping
 */
export async function loadAllSettings() {
	const db = getDb();
	const rows = await db.find("config", undefined, { columns: ["key", "value"] });
	const result = {};
	rows.forEach((r) => {
		result[r.key] = r.value;
	});
	return result;
}

export async function getSetting(key) {
	const db = getDb();
	const row = await db.findOne("config", { key });
	return row?.value ?? null;
}

export async function setSetting(key, value) {
	await upsertKv(key, String(value));
}

/**
 * Update multiple settings in a single batch using native UPSERT
 * db.upsertMany() uses SQLite's INSERT OR REPLACE for atomic batch operations
 * Much more efficient than individual upserts or exists checks
 */
export async function updateMultipleSettings(updates) {
	const db = getDb();
	// Convert object entries to array of records with stringified values
	const records = Object.entries(updates).map(([key, value]) => ({
		key,
		value: String(value),
	}));
	// Single batch upsert operation using PRIMARY KEY constraint
	await db.upsertMany("config", records);
}

// ── History of all posts ────────────────────────────────────────────────────────────

async function loadPosted() {
	const db = getDb();
	const rows = await db.find("history", undefined, { orderBy: "ts", order: "ASC" });
	// Filter out soft-deleted rows (deleted_at is not null)
	return rows
		.filter((r) => !r.deleted_at)
		.map((r) => ({ localId: r.local_id, tweetId: r.tweet_id, ts: r.ts, triggerType: r.trigger_type }));
}

export async function appendPosted(entry) {
	const db = getDb();
	await db.insert("history", {
		local_id: entry.localId,
		tweet_id: entry.tweetId,
		ts: entry.ts,
		trigger_type: entry.triggerType || "manual",
		deleted_at: null,
	});
}

export async function removePosted(localId) {
	const db = getDb();
	const row = await db.findOne("history", { local_id: localId });
	if (row) {
		await db.update("history", { deleted_at: Date.now() }, { local_id: localId });
	}
}

