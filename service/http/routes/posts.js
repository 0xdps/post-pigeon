// service/http/routes/posts.js
// API routes for dynamic posts CRUD
import { Hono } from "hono";
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
} from "../../store/db-posts.js";

export function createPostsRouter() {
	const router = new Hono();

	/**
	 * GET /api/posts - List all posts with filters
	 * Query params: type?, status?, tags?, limit?, offset?, orderBy?
	 */
	router.get("/", async (c) => {
		try {
const type = c.req.query("type");
				const status = c.req.query("status");
				const tags = c.req.query("tags");
				const limit = parseInt(c.req.query("limit") || "50", 10);
				const offset = parseInt(c.req.query("offset") || "0", 10);
				const orderBy = c.req.query("orderBy") || "created_at DESC";

			const posts = await listPosts({ type, status, tags }, { limit, offset, orderBy });

			return c.json({
				success: true,
				count: posts.length,
				posts,
			});
		} catch (err) {
			console.error("GET /posts error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * GET /api/posts/stats - Get post statistics
	 */
	router.get("/stats", async (c) => {
		try {
			const stats = await getPostStats();
			return c.json({
				success: true,
				stats,
			});
		} catch (err) {
			console.error("GET /posts/stats error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * POST /api/posts - Create new post
	 * Body: {id, type, title, metadata?}
	 */
	router.post("/", async (c) => {
		try {
			const body = await c.req.json();
			const { id, type, title, metadata } = body;

			if (!id || !title) {
				return c.json({ success: false, error: "id and title required" }, 400);
			}

			await createPost({ id, type, title, metadata });

			return c.json(
				{
					success: true,
					message: "Post created",
					id,
				},
				201
			);
		} catch (err) {
			console.error("POST /posts error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * GET /api/posts/:id - Get post details with content
	 */
	router.get("/:id", async (c) => {
		try {
			const postId = c.req.param("id");
			const post = await getPost(postId);

			if (!post) {
				return c.json({ success: false, error: "Post not found" }, 404);
			}

			const content = await listPostContent(postId);
			const images = await listPostImages(postId);

			return c.json({
				success: true,
				post: {
					...post,
					content,
					images,
				},
			});
		} catch (err) {
			console.error("GET /posts/:id error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * PUT /api/posts/:id - Update post
	 * Body: {title?, type?, status?, scheduled_at?, metadata?}
	 */
	router.put("/:id", async (c) => {
		try {
			const postId = c.req.param("id");
			const body = await c.req.json();

			// Verify post exists
			const post = await getPost(postId);
			if (!post) {
				return c.json({ success: false, error: "Post not found" }, 404);
			}

			await updatePost(postId, body);

			return c.json({
				success: true,
				message: "Post updated",
			});
		} catch (err) {
			console.error("PUT /posts/:id error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * DELETE /api/posts/:id - Delete post (cascades)
	 */
	router.delete("/:id", async (c) => {
		try {
			const postId = c.req.param("id");

			// Verify post exists
			const post = await getPost(postId);
			if (!post) {
				return c.json({ success: false, error: "Post not found" }, 404);
			}

			await deletePost(postId);

			return c.json({
				success: true,
				message: "Post deleted",
			});
		} catch (err) {
			console.error("DELETE /posts/:id error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	// ═══════════════════════════════════════════════════════════════════
	// Post Content Routes (for threads)

	/**
	 * GET /api/posts/:id/content - List all content for post
	 */
	router.get("/:id/content", async (c) => {
		try {
			const postId = c.req.param("id");

			// Verify post exists
			const post = await getPost(postId);
			if (!post) {
				return c.json({ success: false, error: "Post not found" }, 404);
			}

			const content = await listPostContent(postId);

			return c.json({
				success: true,
				count: content.length,
				content,
			});
		} catch (err) {
			console.error("GET /posts/:id/content error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * POST /api/posts/:id/content - Add content to post (thread)
	 * Body: {text, media_ids?, reply_to_tweet_id?, sequence?}
	 */
	router.post("/:id/content", async (c) => {
		try {
			const postId = c.req.param("id");
			const body = await c.req.json();

			// Verify post exists
			const post = await getPost(postId);
			if (!post) {
				return c.json({ success: false, error: "Post not found" }, 404);
			}

			if (!body.text) {
				return c.json({ success: false, error: "text required" }, 400);
			}

			const contentId = await createPostContent(postId, body);

			return c.json(
				{
					success: true,
					message: "Content added",
					contentId,
				},
				201
			);
		} catch (err) {
			console.error("POST /posts/:id/content error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * PUT /api/posts/:id/content/:contentId - Update content
	 * Body: {text?, media_ids?, reply_to_tweet_id?, sequence?}
	 */
	router.put("/:id/content/:contentId", async (c) => {
		try {
			const contentId = c.req.param("contentId");
			const body = await c.req.json();

			await updatePostContent(contentId, body);

			return c.json({
				success: true,
				message: "Content updated",
			});
		} catch (err) {
			console.error("PUT /posts/:id/content/:contentId error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * DELETE /api/posts/:id/content/:contentId - Delete content
	 */
	router.delete("/:id/content/:contentId", async (c) => {
		try {
			const contentId = c.req.param("contentId");

			await deletePostContent(contentId);

			return c.json({
				success: true,
				message: "Content deleted",
			});
		} catch (err) {
			console.error("DELETE /posts/:id/content/:contentId error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	return router;
}
