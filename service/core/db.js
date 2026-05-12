// service/core/db.js
// Database singleton and schema initialisation.
// The active storage backend is configured in service/store/storage/index.js.
// To swap backends (PostgreSQL, MongoDB, …) change only that file.

import { getStorage } from "../store/storage/index.js";

/**
 * Return the active storage provider (lazy singleton).
 * All store modules call this to get a handle for their queries.
 * @returns {import('../store/storage/MesahubStorage.js').MesahubStorage}
 */
export function getDb() {
	return getStorage();
}

/**
 * Create all application tables if they don't exist, run column migrations,
 * and seed the platforms lookup rows. Safe to call on every startup.
 */
export async function initDb() {
	const db = getDb();
	const mesahubUrl = process.env.MESAHUB_URL || "";
	const dbLabel = mesahubUrl ? mesahubUrl.split("/").pop() : "unknown";
	console.log(`[db] Creating tables on MesaHub / ${dbLabel}...`);

	// ── Core tables ────────────────────────────────────────────────────────────

	await db.exec(`
		CREATE TABLE IF NOT EXISTS config (
			id    INTEGER PRIMARY KEY AUTOINCREMENT,
			key   TEXT    UNIQUE NOT NULL,
			value TEXT    NOT NULL
		)
	`);

	await db.exec(`
		CREATE TABLE IF NOT EXISTS history (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			local_id     TEXT    NOT NULL,
			tweet_id     TEXT    NOT NULL,
			ts           INTEGER NOT NULL,
			trigger_type TEXT    NOT NULL DEFAULT 'manual',
			deleted_at   INTEGER
		)
	`);

	await db.exec(`
		CREATE TABLE IF NOT EXISTS posts (
			id           TEXT    PRIMARY KEY,
			type         TEXT    NOT NULL DEFAULT 'standalone',
			title        TEXT    NOT NULL,
			status       TEXT    NOT NULL DEFAULT 'draft',
			scheduled_at INTEGER,
			metadata     TEXT,
			created_at   INTEGER NOT NULL,
			updated_at   INTEGER NOT NULL
		)
	`);

	await db.exec(`
		CREATE TABLE IF NOT EXISTS post_content (
			id                TEXT    PRIMARY KEY,
			post_id           TEXT    NOT NULL,
			sequence          INTEGER NOT NULL DEFAULT 1,
			text              TEXT    NOT NULL,
			media_ids         TEXT,
			reply_to_tweet_id TEXT,
			reply_to_post_id  TEXT,
			created_at        INTEGER NOT NULL
		)
	`);

	await db.exec(`
		CREATE TABLE IF NOT EXISTS post_images (
			id         TEXT    PRIMARY KEY,
			post_id    TEXT    NOT NULL,
			filename   TEXT    NOT NULL,
			mime_type  TEXT    NOT NULL,
			size       INTEGER NOT NULL,
			file_path  TEXT    NOT NULL,
			created_at INTEGER NOT NULL
		)
	`);

	await db.exec(`
		CREATE TABLE IF NOT EXISTS platforms (
			key         TEXT    PRIMARY KEY,
			name        TEXT    NOT NULL,
			enabled     INTEGER NOT NULL DEFAULT 0,
			auth_status TEXT    NOT NULL DEFAULT 'not_configured',
			config      TEXT,
			created_at  INTEGER NOT NULL,
			updated_at  INTEGER NOT NULL
		)
	`);

	await db.exec(`
		CREATE TABLE IF NOT EXISTS platform_accounts (
			id                  TEXT    PRIMARY KEY,
			platform_key        TEXT    NOT NULL,
			label               TEXT    NOT NULL,
			external_account_id TEXT,
			credentials         TEXT,
			is_active           INTEGER NOT NULL DEFAULT 1,
			created_at          INTEGER NOT NULL,
			updated_at          INTEGER NOT NULL
		)
	`);

	await db.exec(`
		CREATE TABLE IF NOT EXISTS publish_jobs (
			id                   TEXT    PRIMARY KEY,
			post_id              TEXT    NOT NULL,
			platform_key         TEXT    NOT NULL,
			account_id           TEXT,
			status               TEXT    NOT NULL DEFAULT 'pending',
			mode                 TEXT    NOT NULL DEFAULT 'manual',
			scheduled_at         INTEGER,
			random_window_start  TEXT,
			random_window_end    TEXT,
			payload              TEXT,
			error                TEXT,
			platform_post_id     TEXT,
			posted_at            INTEGER,
			created_at           INTEGER NOT NULL,
			updated_at           INTEGER NOT NULL
		)
	`);

	// ── Column migrations (idempotent — duplicate column errors are silently ignored) ──

	const migrations = [
		"ALTER TABLE publish_jobs ADD COLUMN random_window_start TEXT",
		"ALTER TABLE publish_jobs ADD COLUMN random_window_end TEXT",
		"ALTER TABLE publish_jobs ADD COLUMN platform_post_id TEXT",
		"ALTER TABLE publish_jobs ADD COLUMN posted_at INTEGER",
		"ALTER TABLE post_content ADD COLUMN reply_to_post_id TEXT",
	];

	for (const sql of migrations) {
		try {
			await db.exec(sql);
		} catch {
			// Column already exists — safe to ignore
		}
	}

	// ── Seed platform rows ─────────────────────────────────────────────────────

	const now = Date.now();
	await db.exec(
		`INSERT OR IGNORE INTO platforms (key, name, enabled, auth_status, config, created_at, updated_at)
		 VALUES
		 ('twitter',  'X / Twitter', 0, 'not_configured', '{"source":"seed"}', ?, ?),
		 ('linkedin', 'LinkedIn',    0, 'not_configured', '{"source":"seed"}', ?, ?),
		 ('reddit',   'Reddit',      0, 'not_configured', '{"source":"seed"}', ?, ?),
		 ('threads',  'Threads',     0, 'not_configured', '{"source":"seed"}', ?, ?),
		 ('devto',    'Dev.to',      0, 'not_configured', '{"source":"seed"}', ?, ?)`,
		[now, now, now, now, now, now, now, now, now, now]
	);

	console.log("[db] Tables ready.");
}
