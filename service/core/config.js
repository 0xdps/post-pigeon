// service/config.js
// Centralized configuration management
// Reads from database (with setters) and environment variables (as defaults)

import { getSetting, setSetting, loadAllSettings, updateMultipleSettings } from "../store/state-store.js";

// ── Constants (non-configurable) ──────────────────────────────────────────────
export const BANK_PATH = "content/bank.json";
export const START_HOUR = 9; // inclusive
export const END_HOUR = 21; // exclusive

// ── Configuration interface ───────────────────────────────────────────────────

class Config {
	constructor() {
		// In-memory cache of settings (fetch all at once instead of individual queries)
		this._cache = {};
		this._cacheTime = 0;
		this._cacheTTL = 60 * 60 * 1000; // 1 hour — cache only invalidated when settings are updated from admin
	}

	// ── Cache helpers ─────────────────────────────────────────────────────────

	/**
	 * Internal: get from cache or fetch from DB if stale
	 */
	async _ensureCached() {
		const now = Date.now();
		if (!this._cache || now - this._cacheTime > this._cacheTTL) {
			// Cache miss or expired—fetch all settings in one query
			this._cache = await loadAllSettings();
			this._cacheTime = now;
		}
	}

	/**
	 * Get a cached setting value with fallback to environment variable
	 */
	async _getCachedValue(key, envKey, defaultValue) {
		await this._ensureCached();
		const dbValue = this._cache[key];
		return dbValue ?? process.env[envKey] ?? defaultValue;
	}

	// ── Getters with db fallback to env ───────────────────────────────────────

	async getDailyLimit() {
		const value = await this._getCachedValue("daily_limit", "DAILY_LIMIT", 10);
		return Number(value);
	}

	async getPostProbability() {
		const value = await this._getCachedValue("post_probability", "POST_PROBABILITY", 1);
		return Number(value);
	}

	async getCronSchedule() {
		return await this._getCachedValue("cron_schedule", "CRON_SCHEDULE", "0 0 9-20 * * *");
	}

	async getCooldownMinutes() {
		const value = await this._getCachedValue("cooldown_minutes", "COOLDOWN_MINUTES", 60);
		return Number(value);
	}

	async getPostMaxRetries() {
		const value = await this._getCachedValue("post_max_retries", "POST_MAX_RETRIES", 3);
		return Number(value);
	}

	async isPaused() {
		const value = await this._getCachedValue("paused", null, "false");
		return value === "true";
	}

	async getTimezone() {
		return await this._getCachedValue("timezone", "TIMEZONE", "Asia/Kolkata");
	}

	async getCooldownUntil() {
		await this._ensureCached();
		const value = this._cache["cooldown_until"];
		return value ? Number(value) : null;
	}

	async getManualLimitOverride() {
		const value = await this._getCachedValue("manual_limit_override", null, "false");
		return value === "true";
	}

	async getMaxTweetLength() {
		const value = await this._getCachedValue("max_tweet_length", "MAX_TWEET_LENGTH", 1000);
		return Number(value);
	}

	async isDryRun() {
		const value = await this._getCachedValue("dry_run", "DRY_RUN", "false");
		return value === "true" || value === "1";
	}

	async getRandomDelayMinutes() {
		const value = await this._getCachedValue("random_delay_minutes", "RANDOM_DELAY_MINUTES", 15);
		return Number(value);
	}

	async isCronEnabled() {
		const value = await this._getCachedValue("cron_enabled", "CRON_ENABLED", "true");
		return value !== "false";
	}

	async setDailyLimit(value) {
		await setSetting("daily_limit", String(value));
		this._invalidateCache();
	}

	async setPostProbability(value) {
		await setSetting("post_probability", String(value));
		this._invalidateCache();
	}

	async setCronSchedule(value) {
		await setSetting("cron_schedule", String(value));
		this._invalidateCache();
	}

	async setCooldownMinutes(value) {
		await setSetting("cooldown_minutes", String(value));
		this._invalidateCache();
	}

	async setRandomDelayMinutes(value) {
		await setSetting("random_delay_minutes", String(value));
		this._invalidateCache();
	}

	async setPaused(value) {
		await setSetting("paused", value ? "true" : "false");
		this._invalidateCache();
	}

	async setTimezone(value) {
		await setSetting("timezone", String(value));
		this._invalidateCache();
	}

	async setCooldownUntil(value) {
		await setSetting("cooldown_until", String(value ?? 0));
		this._invalidateCache();
	}

	// ── Bulk getters ──────────────────────────────────────────────────────────

	/**
	 * Get all settings as an object
	 * This uses the cached settings (1 query total when called together with other getters)
	 * Useful for dashboard/API endpoints
	 */
	async getAllSettings() {
		await this._ensureCached();
		return {
			daily_limit: Number(this._cache["daily_limit"] ?? process.env.DAILY_LIMIT ?? 10),
			post_probability: Number(this._cache["post_probability"] ?? process.env.POST_PROBABILITY ?? 1),
			cron_schedule: this._cache["cron_schedule"] ?? process.env.CRON_SCHEDULE ?? "0 0 9-20 * * *",
			cooldown_minutes: Number(this._cache["cooldown_minutes"] ?? process.env.COOLDOWN_MINUTES ?? 120),
			post_max_retries: Number(this._cache["post_max_retries"] ?? process.env.POST_MAX_RETRIES ?? 3),
			paused: (this._cache["paused"] ?? "false") === "true",
			timezone: this._cache["timezone"] ?? process.env.TIMEZONE ?? "Asia/Kolkata",
			cooldown_until: this._cache["cooldown_until"] ? Number(this._cache["cooldown_until"]) : null,
			manual_limit_override: (this._cache["manual_limit_override"] ?? "false") === "true",
			max_tweet_length: Number(this._cache["max_tweet_length"] ?? process.env.MAX_TWEET_LENGTH ?? 1000),
			dry_run: (this._cache["dry_run"] ?? process.env.DRY_RUN ?? "false") === "true" || (this._cache["dry_run"] ?? process.env.DRY_RUN ?? "false") === "1",
			cron_enabled: (this._cache["cron_enabled"] ?? process.env.CRON_ENABLED ?? "true") !== "false",
			random_delay_minutes: Number(this._cache["random_delay_minutes"] ?? process.env.RANDOM_DELAY_MINUTES ?? 60),
		};
	}

	/**
	 * Update multiple settings at once in a single batch query
	 * Useful for PATCH /settings endpoint
	 */
	async updateSettings(updates) {
		const settingsToUpdate = {};

		// Build the batch update object
		if ("daily_limit" in updates) settingsToUpdate["daily_limit"] = String(updates.daily_limit);
		if ("post_probability" in updates) settingsToUpdate["post_probability"] = String(updates.post_probability);
		if ("cron_schedule" in updates) settingsToUpdate["cron_schedule"] = String(updates.cron_schedule);
		if ("cooldown_minutes" in updates) settingsToUpdate["cooldown_minutes"] = String(updates.cooldown_minutes);
		if ("post_max_retries" in updates) settingsToUpdate["post_max_retries"] = String(updates.post_max_retries);
		if ("paused" in updates) settingsToUpdate["paused"] = updates.paused ? "true" : "false";
		if ("timezone" in updates) settingsToUpdate["timezone"] = String(updates.timezone);
		if ("clear_cooldown" in updates && updates.clear_cooldown) settingsToUpdate["cooldown_until"] = "0";
		if ("manual_limit_override" in updates) settingsToUpdate["manual_limit_override"] = updates.manual_limit_override ? "true" : "false";
		if ("max_tweet_length" in updates) settingsToUpdate["max_tweet_length"] = String(updates.max_tweet_length);
		if ("dry_run" in updates) settingsToUpdate["dry_run"] = updates.dry_run ? "true" : "false";
		if ("cron_enabled" in updates) settingsToUpdate["cron_enabled"] = updates.cron_enabled ? "true" : "false";
		if ("random_delay_minutes" in updates) settingsToUpdate["random_delay_minutes"] = String(updates.random_delay_minutes);

		// Execute all updates in a single batch
		if (Object.keys(settingsToUpdate).length > 0) {
			await updateMultipleSettings(settingsToUpdate);
			this._invalidateCache();
		}
	}

	// ── Cache management ──────────────────────────────────────────────────────

	_invalidateCache() {
		this._cache = {};
		this._cacheTime = 0;
	}
}

// Export singleton instance
export default new Config();
