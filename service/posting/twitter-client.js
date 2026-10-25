import { readFileSync, writeFileSync } from "fs";
import { TwitterApi } from "twitter-api-v2";
import config from "../core/config.js";

const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15000;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(err) {
	return err?.code || err?.status || err?.statusCode || err?.data?.status;
}

function getErrorDetails(err) {
	const status = getErrorStatus(err) ?? "unknown";
	const title = err?.data?.title || err?.title || "Unknown error";
	const detail = err?.data?.detail || err?.message || "No detail provided";
	const type = err?.data?.type || err?.type || "n/a";
	return { status, title, detail, type };
}

function isRetryableError(err) {
	const status = Number(getErrorStatus(err));
	if (!Number.isFinite(status)) {
		return false;
	}

	// Retry transient API and throttling failures.
	return status === 429 || status === 502 || status === 503 || status === 504;
}

function getRetryDelayMs(attempt, err) {
	// Honor API-provided reset hint for rate limits when available.
	if (Number(getErrorStatus(err)) === 429) {
		const resetAt = Number(err?.rateLimit?.reset) * 1000;
		if (Number.isFinite(resetAt) && resetAt > Date.now()) {
			return Math.min(resetAt - Date.now(), MAX_BACKOFF_MS);
		}
	}

	const exp = BASE_BACKOFF_MS * 2 ** (attempt - 1);
	const jitter = Math.floor(Math.random() * 250);
	return Math.min(exp + jitter, MAX_BACKOFF_MS);
}

const REQUIRED_TWITTER_VARS = [
	"TWITTER_CLIENT_ID",
	"TWITTER_CLIENT_SECRET",
	"TWITTER_ACCESS_TOKEN",
	"TWITTER_ACCESS_REFRESH_TOKEN",
];

// Refresh a little before the 2-hour X access-token lifetime.
const ACCESS_TOKEN_TTL_MS = 110 * 60 * 1000;

let cachedUserClient = null;
let accessTokenExpiresAt = 0;
let refreshInFlight = null;

function readTwitterCredentials() {
	const credentials = {
		clientId: process.env.TWITTER_CLIENT_ID,
		clientSecret: process.env.TWITTER_CLIENT_SECRET,
		accessToken: process.env.TWITTER_ACCESS_TOKEN,
		refreshToken: process.env.TWITTER_ACCESS_REFRESH_TOKEN || process.env.TWIITER_ACCESS_REFRESH_TOKEN,
	};
	const missing = REQUIRED_TWITTER_VARS.filter((name) => {
		if (name === "TWITTER_ACCESS_REFRESH_TOKEN") return !credentials.refreshToken;
		return !process.env[name];
	});
	if (missing.length) {
		throw new Error(`Missing Twitter credentials. Required: ${missing.join(", ")}`);
	}
	return credentials;
}

function persistRefreshedTokens({ accessToken, refreshToken }) {
	process.env.TWITTER_ACCESS_TOKEN = accessToken;
	process.env.TWITTER_ACCESS_REFRESH_TOKEN = refreshToken;
	delete process.env.TWIITER_ACCESS_REFRESH_TOKEN;

	const envPath = process.env.ENV_FILE || ".env";
	let contents;
	try {
		contents = readFileSync(envPath, "utf8");
	} catch {
		console.warn(`[twitter] Refreshed tokens kept in memory only; could not read ${envPath}`);
		return;
	}

	const next = upsertEnvLine(
		upsertEnvLine(contents, "TWITTER_ACCESS_TOKEN", accessToken),
		"TWITTER_ACCESS_REFRESH_TOKEN",
		refreshToken
	).replace(/^TWIITER_ACCESS_REFRESH_TOKEN=.*\n?/m, "");

	writeFileSync(envPath, next.endsWith("\n") ? next : `${next}\n`);
	console.log("[twitter] Saved refreshed OAuth 2.0 tokens");
}

function upsertEnvLine(contents, key, value) {
	const line = `${key}=${value}`;
	const pattern = new RegExp(`^${key}=.*$`, "m");
	if (pattern.test(contents)) return contents.replace(pattern, line);
	return `${contents.replace(/\n?$/, "\n")}${line}\n`;
}

async function refreshUserClient(credentials) {
	const appClient = new TwitterApi({
		clientId: credentials.clientId,
		clientSecret: credentials.clientSecret,
	});
	const { client, accessToken, refreshToken } = await appClient.refreshOAuth2Token(credentials.refreshToken);
	if (!refreshToken) {
		throw new Error("X did not return a new refresh token. Regenerate the OAuth 2.0 user tokens.");
	}
	persistRefreshedTokens({ accessToken, refreshToken });
	cachedUserClient = client;
	accessTokenExpiresAt = Date.now() + ACCESS_TOKEN_TTL_MS;
	return client;
}

/**
 * OAuth 2.0 user client. Refreshes the access token when it is near expiry.
 * X user access tokens last 2 hours; the refresh token lasts about 6 months.
 */
export async function createClient() {
	if (cachedUserClient && Date.now() < accessTokenExpiresAt) return cachedUserClient;
	if (refreshInFlight) return refreshInFlight;

	const credentials = readTwitterCredentials();
	refreshInFlight = refreshUserClient(credentials).finally(() => {
		refreshInFlight = null;
	});
	return refreshInFlight;
}

/**
 * Extract a numeric tweet ID from either a full URL or a bare ID string.
 * e.g. "https://x.com/user/status/1234567890" → "1234567890"
 *      "1234567890" → "1234567890"
 */
function extractTweetId(input) {
	if (!input) return null;
	const match = String(input).match(/\/status\/(\d+)/);
	if (match) return match[1];
	if (/^\d+$/.test(String(input).trim())) return String(input).trim();
	return null;
}

export async function postStatus(client, payload) {
	const { text, media_ids, reply_to_tweet_id } = payload;

	const tweetData = { text };
	if (media_ids) {
		tweetData.media = { media_ids: media_ids.split(",") };
	}
	if (reply_to_tweet_id) {
		const tweetId = extractTweetId(reply_to_tweet_id);
		if (!tweetId) {
			throw new Error(`Invalid reply_to_tweet_id: "${reply_to_tweet_id}". Provide a tweet URL or numeric ID.`);
		}
		tweetData.reply = { in_reply_to_tweet_id: tweetId };
	}

	const configuredRetries = await config.getPostMaxRetries();
	const maxRetries =
		Number.isFinite(configuredRetries) && configuredRetries >= 0 ? configuredRetries : DEFAULT_MAX_RETRIES;

	console.log(
		`Posting to X with retry policy: maxRetries=${maxRetries}, mediaCount=${media_ids ? media_ids.split(",").length : 0}`
	);

	let lastError;
	for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
		try {
			const response = await client.v2.tweet(tweetData);
			if (attempt > 1) {
				console.log(`Post succeeded on retry attempt ${attempt}/${maxRetries + 1}.`);
			}
			return response;
		} catch (err) {
			lastError = err;
			const canRetry = attempt <= maxRetries && isRetryableError(err);
			const { status, title, detail, type } = getErrorDetails(err);

			console.error(
				`Post attempt ${attempt}/${maxRetries + 1} failed: status=${status}, title=${title}, type=${type}, detail=${detail}`
			);

			if (!canRetry) {
				console.error("Not retrying this failure (non-retryable or retry limit reached).");
				throw err;
			}

			const waitMs = getRetryDelayMs(attempt, err);
			console.warn(
				`Transient X API error (${status}) on post attempt ${attempt}/${maxRetries + 1}. Retrying in ${waitMs}ms...`
			);
			await sleep(waitMs);
		}
	}

	if (lastError) {
		const { status, title, detail, type } = getErrorDetails(lastError);
		console.error(
			`Post failed after exhausting retries: status=${status}, title=${title}, type=${type}, detail=${detail}`
		);
	}

	throw lastError;
}

export async function uploadMedia(client, filePath, mimeType = "application/octet-stream") {
	const buffer = readFileSync(filePath);
	return uploadMediaBuffer(client, buffer, mimeType);
}

export async function uploadMediaBuffer(client, buffer, mimeType) {
	return client.v2.uploadMedia(buffer, { media_type: mimeType });
}

export async function deleteStatus(client, tweetId) {
	return client.v2.deleteTweet(tweetId);
}
