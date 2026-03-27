// service/platforms/registry.js
// Central registry of all platform adapters.
// Import this module to resolve any platform key to its adapter instance.
import { TwitterAdapter } from "./twitter-adapter.js";
import { DevToAdapter } from "./devto-adapter.js";
import { RedditAdapter } from "./reddit-adapter.js";
import { LinkedInAdapter } from "./linkedin-adapter.js";
import { ThreadsAdapter } from "./threads-adapter.js";

const _adapters = [
	new TwitterAdapter(),
	new DevToAdapter(),
	new RedditAdapter(),
	new LinkedInAdapter(),
	new ThreadsAdapter(),
];

const _registry = Object.fromEntries(_adapters.map((a) => [a.key, a]));

/**
 * Get a platform adapter by its key.
 * Returns null if no adapter is registered for the given key.
 * @param {string} platformKey
 * @returns {TwitterAdapter|DevToAdapter|RedditAdapter|LinkedInAdapter|ThreadsAdapter|null}
 */
export function getAdapter(platformKey) {
	return _registry[platformKey] || null;
}

/**
 * Get all registered platform adapters.
 * @returns {Array}
 */
export function getRegisteredAdapters() {
	return _adapters;
}
