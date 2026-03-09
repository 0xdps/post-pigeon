// service/platforms/threads-adapter.js
// Threads (Meta) platform adapter — stub. Implement when Threads API credentials are available.
export class ThreadsAdapter {
	get key() {
		return "threads";
	}

	async post(_postId, _opts) {
		throw new Error("Threads adapter is not yet implemented.");
	}

	async delete(_platformPostId) {
		throw new Error("Threads adapter is not yet implemented.");
	}

	async healthCheck() {
		return { connected: false, error: "Threads adapter is not yet implemented." };
	}
}
