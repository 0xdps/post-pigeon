// service/db.js
// sqlite-hub-client singleton + table initialisation
import { connect } from "sqlite-hub-client";

let _db = null;

export function getDb() {
	if (!_db) {
		const { SQLITE_HUB_URL, SQLITE_HUB_SERVICE_SECRET, SQLITE_HUB_DB } = process.env;
		if (!SQLITE_HUB_URL || !SQLITE_HUB_SERVICE_SECRET || !SQLITE_HUB_DB) {
			throw new Error("Missing DB config. Required: SQLITE_HUB_URL, SQLITE_HUB_SERVICE_SECRET, SQLITE_HUB_DB");
		}
		_db = connect({
			url: SQLITE_HUB_URL,
			token: SQLITE_HUB_SERVICE_SECRET,
			db: SQLITE_HUB_DB,
		});
	}
	return _db;
}

export async function initDb() {
	const db = getDb();
	console.log(`[db] Creating tables on ${process.env.SQLITE_HUB_URL} / ${process.env.SQLITE_HUB_DB}...`);
	await db.createTable(
		"config",
		[
			{ name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
			{ name: "key", type: "TEXT", unique: true, notNull: true },
			{ name: "value", type: "TEXT", notNull: true },
		],
		{ ifNotExists: true }
	);

	// history: all tweets published with trigger type and optional deletion
	await db.createTable(
		"history",
		[
			{ name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
			{ name: "local_id", type: "TEXT", notNull: true },
			{ name: "tweet_id", type: "TEXT", notNull: true },
			{ name: "ts", type: "INTEGER", notNull: true }, // when posted
			{ name: "trigger_type", type: "TEXT", notNull: true, default: "manual" }, // manual, cron, queued, scheduled
			{ name: "deleted_at", type: "INTEGER" }, // when user deleted (null = still active)
		],
		{ ifNotExists: true }
	);

	// posts: dynamic post entries (standalone, thread, reply)
	await db.createTable(
		"posts",
		[
			{ name: "id", type: "TEXT", primaryKey: true },
			{ name: "type", type: "TEXT", notNull: true, default: "standalone" }, // standalone, thread, reply
			{ name: "title", type: "TEXT", notNull: true },
			{ name: "status", type: "TEXT", notNull: true, default: "draft" }, // draft, queue, scheduled, posted
			{ name: "scheduled_at", type: "INTEGER" }, // unix timestamp when to post
			{ name: "metadata", type: "TEXT" }, // json: {tags, category, notes}
			{ name: "created_at", type: "INTEGER", notNull: true },
			{ name: "updated_at", type: "INTEGER", notNull: true },
		],
		{ ifNotExists: true }
	);

	// post_content: individual tweet content within a post (for threads)
	await db.createTable(
		"post_content",
		[
			{ name: "id", type: "TEXT", primaryKey: true },
			{ name: "post_id", type: "TEXT", notNull: true },
			{ name: "sequence", type: "INTEGER", notNull: true, default: 1 }, // order in thread
			{ name: "text", type: "TEXT", notNull: true },
			{ name: "media_ids", type: "TEXT" }, // json: ["img-001", "img-002"]
			{ name: "reply_to_tweet_id", type: "TEXT" }, // for replies
			{ name: "created_at", type: "INTEGER", notNull: true },
		],
		{ ifNotExists: true }
	);

	// post_images: image metadata and file paths
	await db.createTable(
		"post_images",
		[
			{ name: "id", type: "TEXT", primaryKey: true },
			{ name: "post_id", type: "TEXT", notNull: true },
			{ name: "filename", type: "TEXT", notNull: true },
			{ name: "mime_type", type: "TEXT", notNull: true },
			{ name: "size", type: "INTEGER", notNull: true },
			{ name: "file_path", type: "TEXT", notNull: true }, // path from sqlite-hub
			{ name: "created_at", type: "INTEGER", notNull: true },
		],
		{ ifNotExists: true }
	);

	// platforms: publish destination definitions
	await db.createTable(
		"platforms",
		[
			{ name: "key", type: "TEXT", primaryKey: true },
			{ name: "name", type: "TEXT", notNull: true },
			{ name: "enabled", type: "INTEGER", notNull: true, default: 0 },
			{ name: "auth_status", type: "TEXT", notNull: true, default: "not_configured" },
			{ name: "config", type: "TEXT" },
			{ name: "created_at", type: "INTEGER", notNull: true },
			{ name: "updated_at", type: "INTEGER", notNull: true },
		],
		{ ifNotExists: true }
	);

	// platform_accounts: account-level credentials per platform
	await db.createTable(
		"platform_accounts",
		[
			{ name: "id", type: "TEXT", primaryKey: true },
			{ name: "platform_key", type: "TEXT", notNull: true },
			{ name: "label", type: "TEXT", notNull: true },
			{ name: "external_account_id", type: "TEXT" },
			{ name: "credentials", type: "TEXT" },
			{ name: "is_active", type: "INTEGER", notNull: true, default: 1 },
			{ name: "created_at", type: "INTEGER", notNull: true },
			{ name: "updated_at", type: "INTEGER", notNull: true },
		],
		{ ifNotExists: true }
	);

	// publish_jobs: platform-specific publish units generated from posts
	await db.createTable(
		"publish_jobs",
		[
			{ name: "id", type: "TEXT", primaryKey: true },
			{ name: "post_id", type: "TEXT", notNull: true },
			{ name: "platform_key", type: "TEXT", notNull: true },
			{ name: "account_id", type: "TEXT" },
			{ name: "status", type: "TEXT", notNull: true, default: "pending" },
			{ name: "mode", type: "TEXT", notNull: true, default: "manual" },
			{ name: "scheduled_at", type: "INTEGER" },
			// resolved random window bounds stored for display / re-scheduling
			{ name: "random_window_start", type: "TEXT" }, // e.g. "09:00"
			{ name: "random_window_end", type: "TEXT" },   // e.g. "21:00"
			{ name: "payload", type: "TEXT" },
			{ name: "error", type: "TEXT" },
			{ name: "platform_post_id", type: "TEXT" }, // ID assigned by the platform after posting
			{ name: "posted_at", type: "INTEGER" },      // actual publish timestamp
			{ name: "created_at", type: "INTEGER", notNull: true },
			{ name: "updated_at", type: "INTEGER", notNull: true },
		],
		{ ifNotExists: true }
	);

	// Migrate existing publish_jobs tables that predate the random-window and platform_post_id columns.
	// ALTER TABLE ADD COLUMN is idempotent in SQLite — we catch 'duplicate column' errors silently.
	const publishJobsMigrations = [
		"ALTER TABLE publish_jobs ADD COLUMN random_window_start TEXT",
		"ALTER TABLE publish_jobs ADD COLUMN random_window_end TEXT",
		"ALTER TABLE publish_jobs ADD COLUMN platform_post_id TEXT",
		"ALTER TABLE publish_jobs ADD COLUMN posted_at INTEGER",
	];
	for (const sql of publishJobsMigrations) {
		try {
			await db.exec(sql);
		} catch {
			// Column already exists — safe to ignore
		}
	}

	// Migrate post_content to support in-app reply chaining
	// (reply_to_post_id links to another post whose platform_post_id is resolved at publish time)
	const postContentMigrations = [
		"ALTER TABLE post_content ADD COLUMN reply_to_post_id TEXT",
	];
	for (const sql of postContentMigrations) {
		try {
			await db.exec(sql);
		} catch {
			// Column already exists — safe to ignore
		}
	}

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

	console.log("DB tables ready.");
}
