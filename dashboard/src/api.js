import { fileManager } from './fileManager.js';

async function reqText(path) {
	const res = await fetch(`/api${path}`, { method: "GET", credentials: "include" });
	if (res.status === 401) { window.location.href = "/login"; return null; }
	return res.ok ? res.text() : null;
}

async function req(method, path, body) {
	const opts = {
		method,
		credentials: "include",
		headers: {},
	};
	if (body !== undefined) {
		opts.headers["Content-Type"] = "application/json";
		opts.body = JSON.stringify(body);
	}
	const res = await fetch(`/api${path}`, opts);
	if (res.status === 401 && path !== "/auth/login") {
		window.location.href = "/login";
		return null;
	}
	try {
		return await res.json();
	} catch {
		return null;
	}
}

function normalizeImageUrl(pathOrUrl) {
	if (!pathOrUrl) return null;

	if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://") || pathOrUrl.startsWith("/api/posts/files/")) {
		return pathOrUrl;
	}

	const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
	const encodedPath = normalizedPath
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");

	return `/api/posts/files${encodedPath}`;
}

function hydrateImage(image) {
	return {
		...image,
		url: normalizeImageUrl(image?.url || image?.file_path),
		file_id: image?.file_path, // Keep file_id for direct access
	};
}

export const api = {
	login: (token) => req("POST", "/auth/login", { token }),
	logout: () => req("POST", "/auth/logout"),
	getState: () => req("GET", "/state"),
	getPosted: () => req("GET", "/posted"),
	trigger: (force = false) => req("POST", "/trigger", { force }),
	postItem: (id, force = false) => req("POST", `/post/${id}`, { force }),
	deletePost: (id) => req("DELETE", `/post/${id}`),
	getBank: () => req("GET", "/bank"),
	getBankItem: (id) => req("GET", `/bank/${id}`),
	getFileText: (fileId) => reqText(`/posts/files/${encodeURIComponent(fileId)}`),
	getQueue: () => req("GET", "/queue"),
	addToQueue: (localId) => req("POST", "/queue", { local_id: localId }),
	removeFromQueue: (id) => req("DELETE", `/queue/${id}`),
	getSettings: () => req("GET", "/settings"),
	updateSettings: (data) => req("PATCH", "/settings", data),
	getTwitterHealth: () => req("GET", "/twitter/health"),
	// Scheduled posts
	getScheduled: () => req("GET", "/scheduled"),
	createScheduled: (localId, scheduledAt) => req("POST", "/scheduled", { local_id: localId, scheduled_at: scheduledAt }),
	deleteScheduled: (id) => req("DELETE", `/scheduled/${id}`),
	cancelScheduled: (id) => req("PATCH", `/scheduled/${id}/cancel`),
	
	// ═══ Dynamic Posts ═══
	// Post management
	listPosts: (filters = {}) => {
		const params = new URLSearchParams();
		if (filters.type) params.append("type", filters.type);
		if (filters.status) params.append("status", filters.status);
		if (filters.tags) params.append("tags", filters.tags);
		if (filters.limit) params.append("limit", filters.limit);
		if (filters.offset) params.append("offset", filters.offset);
		if (filters.orderBy) params.append("orderBy", filters.orderBy);
		return fetch(`/api/posts?${params}`, { credentials: "include" }).then(r => r.json());
	},
	getPostStats: () => req("GET", "/posts/stats"),
	createPost: (postData) => req("POST", "/posts", postData),
	getPost: (postId) => req("GET", `/posts/${postId}`),
	updatePost: (postId, updates) => req("PUT", `/posts/${postId}`, updates),
	deletePost: (postId) => req("DELETE", `/posts/${postId}`),
	
	// Post content (threads)
	listPostContent: (postId) => req("GET", `/posts/${postId}/content`),
	addPostContent: (postId, contentData) => req("POST", `/posts/${postId}/content`, contentData),
	updatePostContent: (postId, contentId, updates) => req("PUT", `/posts/${postId}/content/${contentId}`, updates),
	deletePostContent: (postId, contentId) => req("DELETE", `/posts/${postId}/content/${contentId}`),
	
	// Post images
	createFilesSession: (expiresIn = 30 * 24 * 60 * 60) => req("POST", "/posts/files/session", { expiresIn }),
	listPostImages: async (postId) => {
		const result = await req("GET", `/posts/${postId}/images`);
		if (!result?.success || !Array.isArray(result.images)) return result;

		return {
			...result,
			images: result.images.map(hydrateImage),
		};
	},
	uploadPostImages: async (postId, files, customPath = null) => {
		const formData = new FormData();
		files.forEach(file => formData.append("files", file));
		if (customPath) formData.append("path", customPath);
		
		const res = await fetch(`/api/posts/${postId}/images`, {
			method: "POST",
			credentials: "include",
			body: formData,
		});
		const result = await res.json();
		if (!result?.success || !Array.isArray(result.images)) return result;

		return {
			...result,
			images: result.images.map(hydrateImage),
		};
	},
	deletePostImage: (postId, imageId) => req("DELETE", `/posts/${postId}/images/${imageId}`),
	getPostImage: (postId, imageId) => req("GET", `/posts/${postId}/images/${imageId}/info`),

	// Multi-platform foundation
	getPlatformsCatalog: () => req("GET", "/platforms/catalog"),
	getPlatforms: () => req("GET", "/platforms"),
	updatePlatform: (platformKey, updates) => req("PATCH", `/platforms/${platformKey}`, updates),
	createPlatformAccount: (payload) => req("POST", "/platforms/accounts", payload),
	updatePlatformAccount: (accountId, updates) => req("PATCH", `/platforms/accounts/${accountId}`, updates),
	deletePlatformAccount: (accountId) => req("DELETE", `/platforms/accounts/${accountId}`),
	listPublishJobs: (filters = {}) => {
		const params = new URLSearchParams();
		if (filters.post_id) params.append("post_id", filters.post_id);
		if (filters.platform_key) params.append("platform_key", filters.platform_key);
		if (filters.status) params.append("status", filters.status);
		if (filters.limit) params.append("limit", String(filters.limit));
		const q = params.toString();
		return req("GET", `/schedule${q ? `?${q}` : ""}`);
	},
	createSchedule: (payload) => req("POST", "/schedule", payload),
	deleteSchedule: (jobId) => req("DELETE", `/schedule/${jobId}`),
	publishJob: (jobId) => req("POST", `/schedule/${jobId}/publish`),
	planPublish: (payload) => req("POST", "/platforms/plan", payload),
};

// Initialize file manager (call this on app start)
export async function initializeFileAccess() {
	return fileManager.initialize(api);
}

// Export file manager for direct access
export { fileManager };
