// service/platforms/github-adapter.js
// GitHub platform adapter — stub. Implement when GitHub integration is configured.
// Potential use-cases: GitHub Discussions, GitHub Gists, GitHub Releases.
export class GitHubAdapter {
	get key() {
		return "github";
	}

	async post(_postId, _opts) {
		throw new Error("GitHub adapter is not yet implemented.");
	}

	async delete(_platformPostId) {
		throw new Error("GitHub adapter is not yet implemented.");
	}

	async healthCheck() {
		return { connected: false, error: "GitHub adapter is not yet implemented." };
	}
}
