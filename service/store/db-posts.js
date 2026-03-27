// service/store/db-posts.js
// Database helper functions for dynamic posts, content, and images
import { getDb } from "../core/db.js";

const HUB_TEXT_PREFIX = "@hub:";

/**
 * Extract text_file_id from @hub: prefix if present
 * @param {string} value - Text value (may be @hub:file_id or plain text)
 * @returns {{text_file_id: string|null, text: string}} - Extracted file_id and original text
 */
function extractTextFileId(value) {
	if (typeof value !== "string" || !value.startsWith(HUB_TEXT_PREFIX)) {
		return { text_file_id: null, text: value };
	}

	const fileId = value.slice(HUB_TEXT_PREFIX.length).trim();
	return { text_file_id: fileId || null, text: value };
}

/**
 * Create a new post
 * @param {Object} post - {id, type, title, metadata?}
 * @returns {Promise<void>}
 */
export async function createPost(post) {
	const db = getDb();
	const now = Date.now();
	
	const { id, type = "standalone", title, metadata = {} } = post;
	
	if (!id || !title) {
		throw new Error("Post requires id and title");
	}
	
	await db.insert("posts", {
		id,
		type,
		title,
		status: "draft",
		metadata: JSON.stringify(metadata),
		created_at: now,
		updated_at: now,
	});
}

/**
 * Get post by ID
 * @param {string} postId
 * @returns {Promise<Object>}
 */
export async function getPost(postId) {
	const db = getDb();
	const result = await db.findOne("posts", { id: postId });

	if (!result) return null;
	
	// Parse metadata JSON
	return {
		...result,
		metadata: result.metadata ? JSON.parse(result.metadata) : {},
	};
}

/**
 * List all posts with filters
 * @param {Object} filters - {type?, status?, tags?}
 * @param {Object} options - {limit?, offset?, orderBy?}
 * @returns {Promise<Array>}
 */
export async function listPosts(filters = {}, options = {}) {
	const db = getDb();
	const { type, status, tags } = filters;
	const { limit = 50, offset = 0, orderBy = "created_at DESC" } = options;
	
	let query = "SELECT * FROM posts WHERE 1=1";
	const params = [];
	
	if (type) {
		query += " AND type = ?";
		params.push(type);
	}
	
	if (status) {
		query += " AND status = ?";
		params.push(status);
	}
	
	if (tags) {
		// Search within metadata.tags (JSON contains)
		query += " AND json_extract(metadata, '$.tags') LIKE ?";
		params.push(`%${tags}%`);
	}
	
	query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
	params.push(limit, offset);
	
	const { rows: results } = await db.exec(query, params);

	// Parse metadata JSON for each result
	return results.map(r => ({
		...r,
		metadata: r.metadata ? JSON.parse(r.metadata) : {},
	}));
}

/**
 * Update post
 * @param {string} postId
 * @param {Object} updates - {title?, type?, status?, scheduled_at?, metadata?}
 * @returns {Promise<void>}
 */
export async function updatePost(postId, updates) {
	const db = getDb();
	const now = Date.now();
	
	const updateData = {
		...updates,
		updated_at: now,
	};
	
	// Handle metadata JSON
	if (updates.metadata) {
		updateData.metadata = JSON.stringify(updates.metadata);
	}

	await db.update("posts", updateData, { id: postId });
}

/**
 * Delete post (cascades to content and images)
 * @param {string} postId
 * @returns {Promise<void>}
 */
export async function deletePost(postId) {
	const db = getDb();
	await db.delete("posts", { id: postId });
}

/**
 * Get post count by status
 * @returns {Promise<{draft: number, queue: number, scheduled: number, posted: number}>}
 */
export async function getPostStats() {
	const db = getDb();
	const { rows: result } = await db.exec(
		`SELECT status, COUNT(*) as count FROM posts GROUP BY status`
	);

	const stats = {};
	result.forEach(row => {
		stats[row.status] = row.count;
	});
	
	return stats;
}

// ═══════════════════════════════════════════════════════════════════

/**
 * Create post content (tweet in thread)
 * @param {string} postId
 * @param {Object} content - {text, media_ids?, reply_to_tweet_id?, sequence?}
 * @returns {Promise<string>} content ID
 */
export async function createPostContent(postId, content) {
	const db = getDb();
	const { text, media_ids = [], reply_to_tweet_id = null, sequence = 1 } = content;
	
	if (!text) {
		throw new Error("Content requires text");
	}
	
	const contentId = `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	const now = Date.now();
	
	await db.insert("post_content", {
		id: contentId,
		post_id: postId,
		sequence,
		text,
		media_ids: JSON.stringify(media_ids),
		reply_to_tweet_id,
		created_at: now,
	});
	
	return contentId;
}

/**
 * Get post content by ID
 * @param {string} contentId
 * @returns {Promise<Object>}
 */
export async function getPostContent(contentId) {
	const db = getDb();
	const result = await db.findOne("post_content", { id: contentId });

	if (!result) return null;
	const { text_file_id, text } = extractTextFileId(result.text);
	
	return {
		...result,
		text,
		text_file_id,
		media_ids: result.media_ids ? JSON.parse(result.media_ids) : [],
	};
}

/**
 * List all content for a post
 * @param {string} postId
 * @returns {Promise<Array>}
 */
export async function listPostContent(postId) {
	const db = getDb();
	const results = await db.find("post_content", { post_id: postId }, { orderBy: "sequence", order: "ASC" });

	return results.map((r) => {
		const { text_file_id, text } = extractTextFileId(r.text);
		return {
			...r,
			text,
			text_file_id,
			media_ids: r.media_ids ? JSON.parse(r.media_ids) : [],
		};
	});
}

/**
 * Update post content
 * @param {string} contentId
 * @param {Object} updates - {text?, media_ids?, reply_to_tweet_id?, sequence?}
 * @returns {Promise<void>}
 */
export async function updatePostContent(contentId, updates) {
	const db = getDb();
	
	const updateData = { ...updates };
	
	// Handle media_ids JSON
	if (updates.media_ids) {
		updateData.media_ids = JSON.stringify(updates.media_ids);
	}

	await db.update("post_content", updateData, { id: contentId });
}

/**
 * Delete post content
 * @param {string} contentId
 * @returns {Promise<void>}
 */
export async function deletePostContent(contentId) {
	const db = getDb();
	await db.delete("post_content", { id: contentId });
}

// ═══════════════════════════════════════════════════════════════════

/**
 * Create post image metadata
 * @param {string} postId
 * @param {Object} image - {filename, mime_type, size, file_path}
 * @returns {Promise<string>} image ID
 */
export async function createPostImage(postId, image) {
	const db = getDb();
	const { filename, mime_type, size, file_path } = image;
	
	if (!filename || !mime_type || !size || !file_path) {
		throw new Error("Image requires filename, mime_type, size, file_path");
	}
	
	const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	const now = Date.now();
	
	await db.insert("post_images", {
		id: imageId,
		post_id: postId,
		filename,
		mime_type,
		size,
		file_path,
		created_at: now,
	});
	
	return imageId;
}

/**
 * Get post image by ID
 * @param {string} imageId
 * @returns {Promise<Object>}
 */
export async function getPostImage(imageId) {
	const db = getDb();
	return db.findOne("post_images", { id: imageId });
}

/**
 * List all images for a post
 * @param {string} postId
 * @returns {Promise<Array>}
 */
export async function listPostImages(postId) {
	const db = getDb();
	return db.find("post_images", { post_id: postId }, { orderBy: "created_at", order: "ASC" });
}

/**
 * Delete post image
 * @param {string} imageId
 * @returns {Promise<void>}
 */
export async function deletePostImage(imageId) {
	const db = getDb();
	await db.delete("post_images", { id: imageId });
}

/**
 * Get all images for a post (with file_path accessible)
 * @param {string} postId
 * @returns {Promise<Array>}
 */
export async function getPostImagesByPostId(postId) {
	const db = getDb();
	return db.find("post_images", { post_id: postId }, { columns: ["id", "filename", "mime_type", "size", "file_path"], orderBy: "created_at", order: "ASC" });
}

