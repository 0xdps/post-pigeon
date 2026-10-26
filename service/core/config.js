// service/config.js
// Centralized configuration management
// Reads from database (with setters) and environment variables (as defaults)

import { getSetting, setSetting, loadAllSettings, updateMultipleSettings } from "../store/state-store.js";

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

	async getTimezone() {
		return await this._getCachedValue("timezone", null, "Asia/Kolkata");
	}

	async getMaxTweetLength() {
		const value = await this._getCachedValue("max_tweet_length", null, 280);
		return Number(value);
	}

	async setTimezone(value) {
		await setSetting("timezone", String(value));
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
			timezone: this._cache["timezone"] ?? "Asia/Kolkata",
			max_tweet_length: Number(this._cache["max_tweet_length"] ?? 280),
		};
	}

	/**
	 * Update multiple settings at once in a single batch query
	 * Useful for PATCH /settings endpoint
	 */
	async updateSettings(updates) {
		const settingsToUpdate = {};

		// Build the batch update object
		if ("timezone" in updates) settingsToUpdate["timezone"] = String(updates.timezone);
		if ("max_tweet_length" in updates) settingsToUpdate["max_tweet_length"] = String(updates.max_tweet_length);

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
