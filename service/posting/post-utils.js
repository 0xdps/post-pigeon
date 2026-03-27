import { createClient, postStatus, uploadMediaBuffer } from "./twitter-client.js";
import { listPostContent, listPostImages } from "../store/db-posts.js";
import { listPublishJobs } from "../store/publish-jobs.js";
import { getFileFromHub } from "./sqlite-hub-upload.js";
import config from "../core/config.js";

/**
 * Make a variant of the text based on counter
 * Currently returns text as-is
 */
export function makeVariant(text, idx) {
	return text;
}

/**
 * Validate tweet length
 * @param {string} text - Tweet text
 * @returns {{valid: boolean, length: number, message?: string}}
 */
export function validateTweetLength(text, maxLength) {
	const length = text.length;
	if (length > maxLength) {
		return {
			valid: false,
			length,
			message: `Tweet exceeds ${maxLength} chars (${length} chars)`,
		};
	}
	return { valid: true, length };
}

/**
 * Platform-agnostic variant of preparePost — takes a postId directly (no bank- prefix).
 * Used by platform adapters for posts created via the post editor (posts table).
 * @param {string} postId - ID from the `posts` table
 * @param {Object} [client] - Optional Twitter client (will create one if not provided)
 * @returns {Promise<{tweets: Array<{text: string, mediaIds: string[], reply_to_tweet_id: string|null, sequence: number}>, client: Object}>}
 */
export async function preparePostById(postId, client = null) {
	const contents = await listPostContent(postId);
	if (!contents?.length) {
		throw new Error(`No content found for post ${postId}.`);
	}

	if (!client) {
		client = createClient();
	}

	const maxLength = await config.getMaxTweetLength();

	// Resolve text for every content item in the post (all tweets in a thread)
	const tweets = await Promise.all(
		contents.map(async (c, idx) => {
			let text = c.text?.trim() || "";
			if (c.text_file_id) {
				const file = await getFileFromHub(c.text_file_id);
				if (file?.buffer) text = file.buffer.toString("utf8").trim();
			}

			const validation = validateTweetLength(text, maxLength);
			if (!validation.valid) {
				throw new Error(`Tweet ${idx + 1}: ${validation.message}`);
			}
			console.log(`[preparePostById] postId=${postId} tweet=${idx + 1} length=${validation.length}/${maxLength}`);

			// Resolve in-app reply chain: reply_to_post_id → actual platform tweet ID
			let replyToTweetId = c.reply_to_tweet_id || null;
			if (c.reply_to_post_id && !replyToTweetId) {
				const jobs = await listPublishJobs({ postId: c.reply_to_post_id, platformKey: "twitter", status: "posted" });
				if (!jobs.length) {
					throw new Error(
						`Reply chain error: the linked post has not been published on Twitter yet. ` +
						`Make sure the parent post is published before this one fires.`
					);
				}
				// Use the most recently posted job's platform ID
				const latest = jobs.sort((a, b) => (b.posted_at || 0) - (a.posted_at || 0))[0];
				replyToTweetId = latest.platform_post_id;
				console.log(`[preparePostById] Resolved reply_to_post_id=${c.reply_to_post_id} → tweet ${replyToTweetId}`);
			}

			return {
				text,
				mediaIds: [],
				reply_to_tweet_id: replyToTweetId,
				sequence: c.sequence,
			};
		})
	);

	// Post-level images go to the first tweet (post_images are not per-content-item)
	const images = await listPostImages(postId);
	for (const img of images) {
		const file = await getFileFromHub(img.file_path);
		if (!file?.buffer) {
			console.warn(`[preparePostById] Failed to download image ${img.filename} (${img.file_path}), skipping`);
			continue;
		}
		const mediaId = await uploadMediaBuffer(client, file.buffer, file.mime_type);
		tweets[0].mediaIds.push(mediaId);
	}

	return { tweets, client };
}

/**
 * Post to Twitter with prepared content
 * @param {string} text - Tweet text
 * @param {Array<string>} mediaIds - Media IDs
 * @param {Object} [client] - Optional Twitter client (will create one if not provided)
 * @returns {Promise<string>} Tweet ID
 */
export async function postTweet(text, mediaIds = [], client = null) {
	const payload = { text };

	if (mediaIds.length) {
		payload.media_ids = mediaIds.join(",");
	}

	console.log("Posting tweet (preview):", text.slice(0, 120));

	// Dry-run mode — skip actual posting
	if (await config.isDryRun()) {
		const fakeTweetId = `dry-run-${Date.now()}`;
		console.log(`[DRY_RUN] Would post tweet. Fake ID: ${fakeTweetId}`);
		return fakeTweetId;
	}

	// Reuse client if provided, otherwise create new one
	if (!client) {
		client = createClient();
	}

	const res = await postStatus(client, payload);

	// Extract tweet ID from v2 response
	const tweetId = res?.data?.id || res?.id_str || res?.id;
	if (!tweetId) {
		throw new Error("Twitter API did not return tweet id: " + JSON.stringify(res));
	}

	return String(tweetId);
}
