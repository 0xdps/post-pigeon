// Dashboard file manager for direct sqlite-hub access with header-based auth

class FileManager {
	constructor() {
		this.session = null;
		this.baseUrl = null;
		this.db = null;
		this.blobCache = new Map(); // Cache blob URLs to avoid re-fetching
		this._inFlight = new Map(); // Deduplicate concurrent fetches for same fileId
	}

	/**
	 * Initialize session with sqlite-hub file access token
	 */
	async initialize(apiClient) {
		try {
			const result = await apiClient.createFilesSession();
			if (result?.success) {
				this.session = result.session;
				this.baseUrl = result.base_url;
				this.db = result.db;
				console.log('[FileManager] Initialized with direct file access');
				return true;
			}
		} catch (err) {
			console.warn('[FileManager] Failed to initialize session, will use proxy:', err.message);
		}
		return false;
	}

	/**
	 * Check if direct access is available
	 */
	canUseDirectAccess() {
		return !!(this.session && this.baseUrl && this.db);
	}

	/**
	 * Get file URL for display (creates blob URL with header auth)
	 * @param {string} fileId - File ID from sqlite-hub
	 * @param {string} fallbackUrl - Proxy URL to use if direct access unavailable
	 * @returns {Promise<string>} Blob URL or fallback
	 */
	async getFileUrl(fileId, fallbackUrl) {
		if (!fileId) return fallbackUrl;

		// Return cached blob URL immediately
		if (this.blobCache.has(fileId)) {
			return this.blobCache.get(fileId);
		}

		// Return existing in-flight promise to deduplicate concurrent requests
		if (this._inFlight.has(fileId)) {
			return this._inFlight.get(fileId);
		}

		// Use proxy if no direct access configured
		if (!this.canUseDirectAccess()) {
			return fallbackUrl;
		}

		const promise = (async () => {
			try {
				const url = `${this.baseUrl}/${this.db}/file/${fileId}`;
				const response = await fetch(url, {
					headers: { 'Authorization': `Bearer ${this.session}` },
				});

				if (!response.ok) {
					console.warn(`[FileManager] Failed to fetch ${fileId}, using proxy`);
					return fallbackUrl;
				}

				const blob = await response.blob();
				const blobUrl = URL.createObjectURL(blob);
				this.blobCache.set(fileId, blobUrl);
				return blobUrl;
			} catch (err) {
				console.warn(`[FileManager] Error fetching file ${fileId}:`, err.message);
				return fallbackUrl;
			} finally {
				this._inFlight.delete(fileId);
			}
		})();

		this._inFlight.set(fileId, promise);
		return promise;
	}

	/**
	 * Fetch file content as text directly from sqlite-hub with auth.
	 * @param {string} fileId
	 * @returns {Promise<string|null>}
	 */
	async getFileText(fileId) {
		if (!fileId) return null;
		if (!this.canUseDirectAccess()) return null;

		try {
			const url = `${this.baseUrl}/${this.db}/file/${fileId}`;
			const response = await fetch(url, {
				headers: { 'Authorization': `Bearer ${this.session}` },
			});
			if (!response.ok) {
				console.warn(`[FileManager] Failed to fetch text ${fileId}: ${response.status}`);
				return null;
			}
			return response.text();
		} catch (err) {
			console.warn(`[FileManager] Error fetching text ${fileId}:`, err.message);
			return null;
		}
	}

	/**
	 * Batch fetch multiple file URLs
	 * @param {Array<{id: string, fallback: string}>} files
	 * @returns {Promise<Map<string, string>>} Map of fileId -> blobUrl
	 */
	async batchGetFileUrls(files) {
		const results = new Map();
		
		if (!this.canUseDirectAccess()) {
			// Return all fallbacks
			files.forEach(({ id, fallback }) => results.set(id, fallback));
			return results;
		}

		// Fetch all files in parallel
		await Promise.all(
			files.map(async ({ id, fallback }) => {
				const url = await this.getFileUrl(id, fallback);
				results.set(id, url);
			})
		);

		return results;
	}

	/**
	 * Clean up blob URLs to free memory
	 */
	cleanup() {
		this.blobCache.forEach((blobUrl) => {
			URL.revokeObjectURL(blobUrl);
		});
		this.blobCache.clear();
	}

	/**
	 * Revoke a specific blob URL
	 */
	revokeBlobUrl(fileId) {
		const blobUrl = this.blobCache.get(fileId);
		if (blobUrl) {
			URL.revokeObjectURL(blobUrl);
			this.blobCache.delete(fileId);
		}
	}
}

// Singleton instance
export const fileManager = new FileManager();
