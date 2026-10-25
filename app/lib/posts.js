import {
	createPost,
	getPost,
	listPosts,
	updatePost,
	deletePost,
	getPostStats,
	listPostContent,
	createPostContent,
	updatePostContent,
	deletePostContent,
	listPostImages,
} from "../../service/store/db-posts.js";
import { json } from "./http.js";

export async function listPostsResponse(request) {
	try {
		const params = request.nextUrl.searchParams;
		const posts = await listPosts(
			{
				type: params.get("type") || undefined,
				status: params.get("status") || undefined,
				tags: params.get("tags") || undefined,
			},
			{
				limit: parseInt(params.get("limit") || "50", 10),
				offset: parseInt(params.get("offset") || "0", 10),
				orderBy: params.get("orderBy") || "created_at DESC",
			}
		);
		return json({ success: true, count: posts.length, posts });
	} catch (err) {
		console.error("GET /posts error:", err);
		return json({ success: false, error: err.message }, 500);
	}
}

export async function createPostResponse(body) {
	try {
		const { id, type, title, metadata } = body || {};
		if (!id || !title) return json({ success: false, error: "id and title required" }, 400);
		await createPost({ id, type, title, metadata });
		return json({ success: true, message: "Post created", id }, 201);
	} catch (err) {
		console.error("POST /posts error:", err);
		return json({ success: false, error: err.message }, 500);
	}
}

export async function getPostResponse(postId) {
	try {
		const post = await getPost(postId);
		if (!post) return json({ success: false, error: "Post not found" }, 404);
		const [content, images] = await Promise.all([listPostContent(postId), listPostImages(postId)]);
		return json({ success: true, post: { ...post, content, images } });
	} catch (err) {
		console.error("GET /posts/:id error:", err);
		return json({ success: false, error: err.message }, 500);
	}
}

export async function updatePostResponse(postId, body) {
	try {
		const post = await getPost(postId);
		if (!post) return json({ success: false, error: "Post not found" }, 404);
		await updatePost(postId, body);
		return json({ success: true, message: "Post updated" });
	} catch (err) {
		console.error("PUT /posts/:id error:", err);
		return json({ success: false, error: err.message }, 500);
	}
}

export async function deletePostResponse(postId) {
	try {
		const post = await getPost(postId);
		if (!post) return json({ success: false, error: "Post not found" }, 404);
		await deletePost(postId);
		return json({ success: true, message: "Post deleted" });
	} catch (err) {
		console.error("DELETE /posts/:id error:", err);
		return json({ success: false, error: err.message }, 500);
	}
}

export async function statsResponse() {
	try {
		return json({ success: true, stats: await getPostStats() });
	} catch (err) {
		console.error("GET /posts/stats error:", err);
		return json({ success: false, error: err.message }, 500);
	}
}

export async function listContentResponse(postId) {
	try {
		const post = await getPost(postId);
		if (!post) return json({ success: false, error: "Post not found" }, 404);
		const content = await listPostContent(postId);
		return json({ success: true, count: content.length, content });
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function createContentResponse(postId, body) {
	try {
		const post = await getPost(postId);
		if (!post) return json({ success: false, error: "Post not found" }, 404);
		if (!body?.text) return json({ success: false, error: "text required" }, 400);
		const contentId = await createPostContent(postId, body);
		return json({ success: true, message: "Content added", contentId }, 201);
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function updateContentResponse(contentId, body) {
	try {
		await updatePostContent(contentId, body);
		return json({ success: true, message: "Content updated" });
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function deleteContentResponse(contentId) {
	try {
		await deletePostContent(contentId);
		return json({ success: true, message: "Content deleted" });
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}
