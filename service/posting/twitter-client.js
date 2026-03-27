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

export function createClient() {
	const {
		TWITTER_API_KEY,
		TWITTER_API_KEY_SECRET,
		TWITTER_ACCESS_TOKEN,
		TWITTER_ACCESS_TOKEN_SECRET,
	} = process.env;

	if (!TWITTER_API_KEY || !TWITTER_API_KEY_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
		throw new Error(
			"Missing Twitter credentials. Required: TWITTER_API_KEY, TWITTER_API_KEY_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET"
		);
	}

	return new TwitterApi({
		appKey: TWITTER_API_KEY,
		appSecret: TWITTER_API_KEY_SECRET,
		accessToken: TWITTER_ACCESS_TOKEN,
		accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
	});
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

export async function uploadMedia(client, filePath) {
	const mediaId = await client.v1.uploadMedia(filePath);
	return mediaId;
}

export async function uploadMediaBuffer(client, buffer, mimeType) {
	const mediaId = await client.v1.uploadMedia(buffer, { mimeType });
	return mediaId;
}

export async function deleteStatus(client, tweetId) {
	return client.v2.deleteTweet(tweetId);
}
