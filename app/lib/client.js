async function req(method, path, body) {
	const opts = { method, credentials: "include", headers: {} };
	if (body !== undefined) {
		opts.headers["Content-Type"] = "application/json";
		opts.body = JSON.stringify(body);
	}
	const res = await fetch(path, opts);
	if (res.status === 401 && !path.endsWith("/auth/login")) {
		window.location.href = "/login";
		return null;
	}
	try {
		return await res.json();
	} catch {
		return null;
	}
}

export const api = {
	listPosts: (filters = {}) => {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(filters)) {
			if (value) params.set(key, value);
		}
		const query = params.toString();
		return req("GET", `/api/posts${query ? `?${query}` : ""}`);
	},
	getPost: (id) => req("GET", `/api/posts/${id}`),
	createPost: (post) => req("POST", "/api/posts", post),
	updatePost: (id, updates) => req("PUT", `/api/posts/${id}`, updates),
	deletePost: (id) => req("DELETE", `/api/posts/${id}`),
	addContent: (id, content) => req("POST", `/api/posts/${id}/content`, content),
	updateContent: (id, contentId, content) => req("PUT", `/api/posts/${id}/content/${contentId}`, content),
	deleteContent: (id, contentId) => req("DELETE", `/api/posts/${id}/content/${contentId}`),
	listImages: (id) => req("GET", `/api/posts/${id}/images`),
	uploadFiles: async (files) => {
		const form = new FormData();
		for (const file of files) form.append("files", file);
		const res = await fetch("/api/uploads", { method: "POST", credentials: "include", body: form });
		return res.json();
	},
	deleteUpload: (imageId) => req("DELETE", `/api/uploads/${imageId}`),
	uploadImages: async (id, files) => {
		const form = new FormData();
		for (const file of files) form.append("files", file);
		const res = await fetch(`/api/posts/${id}/images`, { method: "POST", credentials: "include", body: form });
		return res.json();
	},
	deleteImage: (id, imageId) => req("DELETE", `/api/posts/${id}/images/${imageId}`),
	createSchedule: (payload) => req("POST", "/api/schedule", payload),
	publishJob: (jobId) => req("POST", `/api/schedule/${jobId}/publish`),
	twitterHealth: () => req("GET", "/api/twitter/health"),
	getSettings: () => req("GET", "/api/settings"),
	updateSettings: (data) => req("PATCH", "/api/settings", data),
	getStats: () => req("GET", "/api/posts/stats"),
	getPlatforms: () => req("GET", "/api/platforms"),
	updatePlatform: (key, updates) => req("PATCH", `/api/platforms/${key}`, updates),
	listJobs: (filters = {}) => {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(filters)) {
			if (value) params.set(key, value);
		}
		const query = params.toString();
		return req("GET", `/api/schedule${query ? `?${query}` : ""}`);
	},
	cancelJob: (jobId) => req("DELETE", `/api/schedule/${jobId}`),
	logout: () => req("POST", "/api/auth/logout"),
};

export function imageSrc(image) {
	const path = image?.proxy_url || image?.url || image?.file_path;
	if (!path) return "";
	if (path.startsWith("http") || path.startsWith("/api/")) return path;
	return `/api/posts/files/${encodeURIComponent(path)}`;
}
