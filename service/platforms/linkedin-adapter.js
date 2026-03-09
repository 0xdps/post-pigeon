// service/platforms/linkedin-adapter.js
// LinkedIn platform adapter — stub. Implement when LinkedIn OAuth credentials are available.
export class LinkedInAdapter {
	get key() {
		return "linkedin";
	}

	async post(_postId, _opts) {
		throw new Error("LinkedIn adapter is not yet implemented.");
	}

	async delete(_platformPostId) {
		throw new Error("LinkedIn adapter is not yet implemented.");
	}

	async healthCheck() {
		return { connected: false, error: "LinkedIn adapter is not yet implemented." };
	}
}
