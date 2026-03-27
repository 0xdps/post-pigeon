import { randomUUID } from "crypto";
import { getDb } from "../core/db.js";
import { PLATFORM_CATALOG } from "../platforms/adapters.js";

function parseJson(value, fallback) {
	if (!value) return fallback;
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

export async function seedPlatformsIfMissing() {
	const db = getDb();
	const now = Date.now();
	for (const p of PLATFORM_CATALOG) {
		await db.exec(
			`INSERT OR IGNORE INTO platforms (key, name, enabled, auth_status, config, created_at, updated_at)
			 VALUES (?, ?, 0, 'not_configured', ?, ?, ?)`,
			[p.key, p.name, JSON.stringify({ capabilities: p.capabilities }), now, now]
		);
	}
}

/**
 * For each platform, inspect environment variables and auto-enable + update
 * auth_status if credentials are present. Only promotes status — never demotes
 * a platform that was manually enabled but whose env vars were later removed.
 */
export async function syncPlatformCredentialsFromEnv() {
	const db = getDb();
	const now = Date.now();

	const CREDENTIAL_MAP = {
		twitter:  ["TWITTER_API_KEY", "TWITTER_API_KEY_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_TOKEN_SECRET"],
		linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_PERSON_URN"],
		threads:  ["THREADS_APP_ID", "THREADS_APP_SECRET", "THREADS_ACCESS_TOKEN", "THREADS_USER_ID"],
		devto:    ["DEVTO_API_KEY"],
		// bluesky: adapter + catalog entry not yet implemented
	};

	for (const [key, envVars] of Object.entries(CREDENTIAL_MAP)) {
		const allSet = envVars.every((v) => !!process.env[v]);
		if (!allSet) continue;

		const row = await db.findOne("platforms", { key });
		if (!row) continue;

		// Only update if not already enabled/configured to avoid overwriting manual changes
		if (!row.enabled || row.auth_status === "not_configured") {
			await db.update(
				"platforms",
				{ enabled: 1, auth_status: "configured", updated_at: now },
				{ key }
			);
			console.log(`[platforms] Auto-enabled '${key}' (credentials found in env)`);
		}
	}
}

export async function listPlatforms() {
	const db = getDb();
	const rows = await db.find("platforms", undefined, { orderBy: "name", order: "ASC" });
	return rows.map((r) => ({
		...r,
		enabled: !!r.enabled,
		config: parseJson(r.config, {}),
	}));
}

export async function updatePlatform(platformKey, updates = {}) {
	const db = getDb();
	const current = await db.findOne("platforms", { key: platformKey });
	if (!current) throw new Error(`Platform not found: ${platformKey}`);

	const next = {
		name: updates.name ?? current.name,
		enabled: updates.enabled === undefined ? current.enabled : (updates.enabled ? 1 : 0),
		auth_status: updates.auth_status ?? current.auth_status,
		config: JSON.stringify(updates.config ?? parseJson(current.config, {})),
		updated_at: Date.now(),
	};

	await db.update("platforms", next, { key: platformKey });
	return db.findOne("platforms", { key: platformKey });
}

export async function listPlatformAccounts(platformKey = null) {
	const db = getDb();
	const rows = platformKey
		? await db.find("platform_accounts", { platform_key: platformKey }, { orderBy: "created_at", order: "DESC" })
		: await db.find("platform_accounts", undefined, { orderBy: "created_at", order: "DESC" });

	return rows.map((r) => ({
		...r,
		is_active: !!r.is_active,
		credentials: parseJson(r.credentials, {}),
	}));
}

export async function createPlatformAccount(payload) {
	const db = getDb();
	const now = Date.now();
	const id = payload.id || `acct-${randomUUID()}`;
	await db.insert("platform_accounts", {
		id,
		platform_key: payload.platform_key,
		label: payload.label,
		external_account_id: payload.external_account_id || null,
		credentials: JSON.stringify(payload.credentials || {}),
		is_active: payload.is_active === false ? 0 : 1,
		created_at: now,
		updated_at: now,
	});
	return db.findOne("platform_accounts", { id });
}

export async function updatePlatformAccount(accountId, updates = {}) {
	const db = getDb();
	const current = await db.findOne("platform_accounts", { id: accountId });
	if (!current) throw new Error(`Account not found: ${accountId}`);

	await db.update("platform_accounts", {
		label: updates.label ?? current.label,
		external_account_id: updates.external_account_id ?? current.external_account_id,
		credentials: JSON.stringify(updates.credentials ?? parseJson(current.credentials, {})),
		is_active: updates.is_active === undefined ? current.is_active : (updates.is_active ? 1 : 0),
		updated_at: Date.now(),
	}, { id: accountId });

	return db.findOne("platform_accounts", { id: accountId });
}

export async function deletePlatformAccount(accountId) {
	const db = getDb();
	await db.delete("platform_accounts", { id: accountId });
}

export async function createPublishJob(payload) {
	const db = getDb();
	const now = Date.now();
	const id = payload.id || `job-${randomUUID()}`;
	await db.insert("publish_jobs", {
		id,
		post_id: payload.post_id,
		platform_key: payload.platform_key,
		account_id: payload.account_id || null,
		status: payload.status || "dry_run_ok",
		mode: payload.mode || "manual",
		scheduled_at: payload.scheduled_at || null,
		payload: JSON.stringify(payload.payload || {}),
		error: payload.error || null,
		created_at: now,
		updated_at: now,
	});
	return db.findOne("publish_jobs", { id });
}

export async function listPublishJobs(filters = {}) {
	const db = getDb();
	const where = {};
	if (filters.post_id) where.post_id = filters.post_id;
	if (filters.platform_key) where.platform_key = filters.platform_key;
	if (filters.status) where.status = filters.status;

	const rows = await db.find("publish_jobs", Object.keys(where).length ? where : undefined, {
		orderBy: "created_at",
		order: "DESC",
		limit: Number(filters.limit || 100),
	});

	return rows.map((r) => ({
		...r,
		payload: parseJson(r.payload, {}),
	}));
}
