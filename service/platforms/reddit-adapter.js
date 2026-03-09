// service/platforms/reddit-adapter.js
// Reddit platform adapter — stub. Implement when Reddit OAuth credentials are available.
export class RedditAdapter {
	get key() {
		return "reddit";
	}

	async post(_postId, _opts) {
		throw new Error("Reddit adapter is not yet implemented.");
	}

	async delete(_platformPostId) {
		throw new Error("Reddit adapter is not yet implemented.");
	}

	async healthCheck() {
		return { connected: false, error: "Reddit adapter is not yet implemented." };
	}
}
