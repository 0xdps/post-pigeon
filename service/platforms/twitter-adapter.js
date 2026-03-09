// service/platforms/twitter-adapter.js
// Twitter platform adapter — the reference implementation.
// Wraps existing twitter-client.js and uses preparePostById for content resolution.
import { createClient, postStatus, deleteStatus } from "../posting/twitter-client.js";
import { preparePostById } from "../posting/post-utils.js";
import config from "../core/config.js";

export class TwitterAdapter {
	get key() {
		return "twitter";
	}

	/**
	 * Publish a post to Twitter.
	 * Handles standalone, reply, and thread post types.
	 * @param {string} postId - ID from the `posts` table
	 * @param {{ payloadOverrides?: object, dryRun?: boolean }} opts
	 * @returns {Promise<{ platformPostId: string, url: string|null }>}
	 */
	async post(postId, { payloadOverrides = {}, dryRun = false } = {}) {
		const client = createClient();
		const { tweets } = await preparePostById(postId, client);

		if (dryRun || (await config.isDryRun())) {
			const fakeId = `dry-run-${Date.now()}`;
			console.log(`[twitter-adapter] DRY RUN — postId=${postId}, fakeId=${fakeId}, tweets=${tweets.length}`);
			return { platformPostId: fakeId, url: null };
		}

		let firstTweetId = null;
		let previousTweetId = null;

		for (const tweet of tweets) {
			const { text, mediaIds, reply_to_tweet_id } = tweet;

			const payload = { text };
			if (mediaIds.length) payload.media_ids = mediaIds.join(",");

			// For reply-type posts use the stored reply_to_tweet_id on the first tweet;
			// for subsequent thread tweets, chain onto the previous tweet.
			const replyTarget = previousTweetId ?? reply_to_tweet_id ?? null;
			if (replyTarget) payload.reply_to_tweet_id = replyTarget;

			const res = await postStatus(client, payload);
			const tweetId = String(res?.data?.id || res?.id_str || res?.id || "");
			if (!tweetId) {
				throw new Error("Twitter API did not return a tweet id: " + JSON.stringify(res));
			}

			if (!firstTweetId) firstTweetId = tweetId;
			previousTweetId = tweetId;
		}

		return {
			platformPostId: firstTweetId,
			url: `https://x.com/i/web/status/${firstTweetId}`,
		};
	}

	/**
	 * Delete a tweet by its platform-assigned ID.
	 * @param {string} platformPostId - Tweet ID returned from post()
	 */
	async delete(platformPostId) {
		const client = createClient();
		await deleteStatus(client, platformPostId);
	}

	/**
	 * Verify the configured credentials are valid and return the account username.
	 * @returns {Promise<{ connected: boolean, username?: string, error?: string }>}
	 */
	async healthCheck() {
		try {
			const client = createClient();
			const me = await client.v2.me();
			return { connected: true, username: me.data?.username };
		} catch (err) {
			return { connected: false, error: err.message };
		}
	}
}
