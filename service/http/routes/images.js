// service/http/routes/images.js
// API routes for post image uploads and management
import { Hono } from "hono";
import { getPost } from "../../store/db-posts.js";
import { getDb } from "../../core/db.js";
import {
	createPostImage,
	listPostImages,
	deletePostImage,
	getPostImage,
} from "../../store/db-posts.js";
import {
	uploadFileToHub,
	deleteFileFromHub,
	getFileFromHub,
	getFileUrl,
	createPresignedFileUrl,
	listAllFileIdsFromHub,
	validateFile,
	isValidImageType,
} from "../../posting/sqlite-hub-upload.js";

export function createImagesRouter() {
	const router = new Hono();

	/**
	 * GET /api/posts/images/integrity - Check for post_images entries without file content
	 */
	router.get("/images/integrity", async (c) => {
		try {
			const db = getDb();
			const postImages = await db.find("post_images", {}, { orderBy: "created_at", order: "ASC" });
			const hubFileIds = await listAllFileIdsFromHub();

			const missing = postImages
				.filter((image) => !hubFileIds.has(image.file_path))
				.map((image) => ({
					id: image.id,
					post_id: image.post_id,
					filename: image.filename,
					mime_type: image.mime_type,
					size: image.size,
					file_path: image.file_path,
					created_at: image.created_at,
				}));

			return c.json({
				success: true,
				total_images: postImages.length,
				total_files: hubFileIds.size,
				orphaned_count: missing.length,
				orphaned: missing,
			});
		} catch (err) {
			console.error("GET /posts/images/integrity error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * POST /api/posts/files/session - Previously created long-lived file read tokens.
	 * Session tokens are not supported by @mesahub/client; all file access
	 * goes through the backend proxy at /api/posts/files/:id.
	 */
	router.post("/files/session", async (c) => {
		return c.json(
			{
				success: false,
				error: "Direct file session tokens are not supported. Use the /api/posts/files/:id proxy endpoint instead.",
			},
			501
		);
	});

	/**
	 * GET /api/posts/:id/images - List all images for a post
	 */
	router.get("/:id/images", async (c) => {
		try {
			const postId = c.req.param("id");

			// Verify post exists
			const post = await getPost(postId);
			if (!post) {
				return c.json({ success: false, error: "Post not found" }, 404);
			}

			const images = await listPostImages(postId);
			const imagesWithUrls = await Promise.all(
				images.map(async (image) => {
					let presigned = null;
					try {
						presigned = await createPresignedFileUrl(image.file_path, 1800);
					} catch {
						// Fallback to backend proxy URL when presign fails.
					}

					return {
						...image,
						url: presigned?.url || getFileUrl(image.file_path),
						proxy_url: getFileUrl(image.file_path),
						presigned_expires_at: presigned?.expires_at || null,
					};
				})
			);

			return c.json({
				success: true,
				count: imagesWithUrls.length,
				images: imagesWithUrls,
			});
		} catch (err) {
			console.error("GET /posts/:id/images error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * POST /api/posts/:id/images - Upload image(s) to a post
	 * Expected: multipart/form-data with 'files' field + optional 'path' field
	 * path format: 'posts/001' (will be normalized)
	 */
	router.post("/:id/images", async (c) => {
		try {
			const postId = c.req.param("id");

			// Verify post exists
			const post = await getPost(postId);
			if (!post) {
				return c.json({ success: false, error: "Post not found" }, 404);
			}

			const formData = await c.req.formData();
			const files = formData.getAll("files");
			const customPath = String(formData.get("path") || `posts/${postId}`);

			if (!files || files.length === 0) {
				return c.json({ success: false, error: "No files provided" }, 400);
			}

			const uploadedImages = [];
			const errors = [];

			for (const file of files) {
				if (!file || !(file instanceof File)) {
					continue;
				}

				// Validate file type
				const mimeType = file.type;
				if (!isValidImageType(mimeType)) {
					errors.push(`${file.name}: Invalid file type. Only PNG, JPEG, GIF, WebP, AVIF allowed.`);
					continue;
				}

				// Validate file size
				const sizeCheck = validateFile(file);
				if (!sizeCheck.valid) {
					errors.push(`${file.name}: ${sizeCheck.error}`);
					continue;
				}

				try {
					// Convert File to Buffer
					const arrayBuffer = await file.arrayBuffer();
					const buffer = Buffer.from(arrayBuffer);

					// Upload to SQLite Hub
					const uploadResult = await uploadFileToHub(buffer, customPath, file.name, mimeType);

					// Create image record in DB
					const imageId = await createPostImage(postId, {
						filename: file.name,
						mime_type: mimeType,
						size: buffer.length,
						file_path: uploadResult.file_path,
					});

					uploadedImages.push({
						id: imageId,
						filename: file.name,
						mime_type: mimeType,
						size: buffer.length,
						file_path: uploadResult.file_path,
						url: uploadResult.url,
					});

					console.log(`[images] Uploaded image for post ${postId}: ${imageId} → ${uploadResult.file_path}`);
				} catch (uploadErr) {
					errors.push(`${file.name}: ${uploadErr.message}`);
					console.error(`[images] Upload failed for ${file.name}:`, uploadErr);
				}
			}

			// If no images uploaded successfully, return error
			if (uploadedImages.length === 0) {
				return c.json(
					{
						success: false,
						error: "No images were uploaded",
						errors,
					},
					400
				);
			}

			return c.json(
				{
					success: true,
					message: `${uploadedImages.length} image(s) uploaded${errors.length > 0 ? ` (${errors.length} failed)` : ""}`,
					images: uploadedImages,
					errors: errors.length > 0 ? errors : undefined,
				},
				201
			);
		} catch (err) {
			console.error("POST /posts/:id/images error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * DELETE /api/posts/:id/images/:imageId - Delete an image
	 */
	router.delete("/:id/images/:imageId", async (c) => {
		try {
			const postId = c.req.param("id");
			const imageId = c.req.param("imageId");

			// Verify post exists
			const post = await getPost(postId);
			if (!post) {
				return c.json({ success: false, error: "Post not found" }, 404);
			}

			// Verify image exists and belongs to post
			const image = await getPostImage(imageId);
			if (!image || image.post_id !== postId) {
				return c.json({ success: false, error: "Image not found for this post" }, 404);
			}

			// Delete from SQLite Hub
			const filePath = image.file_path;
			if (filePath) {
				await deleteFileFromHub(filePath);
			}

			// Delete from DB
			await deletePostImage(imageId);

			console.log(`[images] Deleted image ${imageId} from post ${postId} (path: ${filePath})`);

			return c.json({
				success: true,
				message: "Image deleted",
			});
		} catch (err) {
			console.error("DELETE /posts/:id/images/:imageId error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * GET /api/posts/:id/images/:imageId/info - Get image metadata
	 */
	router.get("/:id/images/:imageId/info", async (c) => {
		try {
			const postId = c.req.param("id");
			const imageId = c.req.param("imageId");

			// Verify image exists and belongs to post
			const image = await getPostImage(imageId);
			if (!image || image.post_id !== postId) {
				return c.json({ success: false, error: "Image not found" }, 404);
			}

			return c.json({
				success: true,
				image: {
					...image,
					proxy_url: getFileUrl(image.file_path),
					url: getFileUrl(image.file_path),
				},
			});
		} catch (err) {
			console.error("GET /posts/:id/images/:imageId/info error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * GET /api/posts/files/* - Serve uploaded file bytes
	 */
	router.get("/files/:fileId", async (c) => {
		try {
			const filePath = c.req.param("fileId");

			const file = await getFileFromHub(filePath);
			if (!file) {
				return c.json({ success: false, error: "File not found" }, 404);
			}

			return new Response(file.buffer, {
				status: 200,
				headers: {
					"Content-Type": file.mime_type || "application/octet-stream",
					"Content-Length": String(file.size || file.buffer.length),
					"Cache-Control": "private, max-age=3600",
					"Content-Disposition": `inline; filename=\"${file.filename}\"`,
				},
			});
		} catch (err) {
			console.error("GET /posts/files/:fileId error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	/**
	 * GET /api/posts/:id/images/:imageId/download - Redirect to file URL
	 * (Served by API route backed by sqlite-hub table storage)
	 */
	router.get("/:id/images/:imageId/download", async (c) => {
		try {
			const postId = c.req.param("id");
			const imageId = c.req.param("imageId");

			// Verify image exists and belongs to post
			const image = await getPostImage(imageId);
			if (!image || image.post_id !== postId) {
				return c.json({ success: false, error: "Image not found" }, 404);
			}

			const file = await getFileFromHub(image.file_path);
			if (!file) {
				return c.json({ success: false, error: "Image file not found" }, 404);
			}

			return new Response(file.buffer, {
				status: 200,
				headers: {
					"Content-Type": file.mime_type || image.mime_type || "application/octet-stream",
					"Content-Length": String(file.size || file.buffer.length),
					"Cache-Control": "private, max-age=3600",
					"Content-Disposition": `inline; filename=\"${image.filename}\"`,
				},
			});
		} catch (err) {
			console.error("GET /posts/:id/images/:imageId/download error:", err);
			return c.json({ success: false, error: err.message }, 500);
		}
	});

	return router;
}
