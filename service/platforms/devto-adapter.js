// service/platforms/devto-adapter.js
// Dev.to platform adapter — stub. Implement when DEV_TO_API_KEY is available.
export class DevToAdapter {
	get key() {
		return "devto";
	}

	async post(_postId, _opts) {
		throw new Error("Dev.to adapter is not yet implemented.");
	}

	async delete(_platformPostId) {
		throw new Error("Dev.to adapter is not yet implemented.");
	}

	async healthCheck() {
		return { connected: false, error: "Dev.to adapter is not yet implemented." };
	}
}
