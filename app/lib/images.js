import { getDb } from "../../service/core/db.js";
import { getPost, createPostImage, listPostImages, deletePostImage, getPostImage } from "../../service/store/db-posts.js";
import {
	uploadFileToHub,
	deleteFileFromHub,
	getFileFromHub,
	getFileUrl,
	createPresignedFileUrl,
	listAllFileIdsFromHub,
	validateFile,
	isValidImageType,
} from "../../service/posting/sqlite-hub-upload.js";
import { json } from "./http.js";

function fileResponse(file, filename) {
	return new Response(file.buffer, {
		status: 200,
		headers: {
			"Content-Type": file.mime_type || "application/octet-stream",
			"Content-Length": String(file.size || file.buffer.length),
			"Cache-Control": "private, max-age=3600",
			"Content-Disposition": `inline; filename="${filename || file.filename}"`,
		},
	});
}

export async function imagesIntegrityResponse() {
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
		return json({
			success: true,
			total_images: postImages.length,
			total_files: hubFileIds.size,
			orphaned_count: missing.length,
			orphaned: missing,
		});
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export function filesSessionResponse() {
	return json(
		{
			success: false,
			error: "Direct file session tokens are not supported. Use the /api/posts/files/:id proxy endpoint instead.",
		},
		501
	);
}

export async function listImagesResponse(postId) {
	try {
		const post = await getPost(postId);
		if (!post) return json({ success: false, error: "Post not found" }, 404);
		const images = await listPostImages(postId);
		const imagesWithUrls = await Promise.all(
			images.map(async (image) => {
				let presigned = null;
				try {
					presigned = await createPresignedFileUrl(image.file_path, 1800);
				} catch {
					// Fall back to the backend proxy URL.
				}
				return {
					...image,
					url: presigned?.url || getFileUrl(image.file_path),
					proxy_url: getFileUrl(image.file_path),
					presigned_expires_at: presigned?.expires_at || null,
				};
			})
		);
		return json({ success: true, count: imagesWithUrls.length, images: imagesWithUrls });
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function uploadFilesResponse(formData) {
	try {
		const files = formData.getAll("files");
		if (!files?.length) return json({ success: false, error: "No files provided" }, 400);

		const images = [];
		const errors = [];
		for (const file of files) {
			if (!file || typeof file.arrayBuffer !== "function") continue;
			if (!isValidImageType(file.type)) {
				errors.push(`${file.name}: Invalid file type. Only PNG, JPEG, GIF, WebP, AVIF allowed.`);
				continue;
			}
			const sizeCheck = validateFile(file);
			if (!sizeCheck.valid) {
				errors.push(`${file.name}: ${sizeCheck.error}`);
				continue;
			}
			try {
				const buffer = Buffer.from(await file.arrayBuffer());
				const uploadResult = await uploadFileToHub(buffer, "posts", file.name, file.type);
				const imageId = await createPostImage(null, {
					filename: file.name,
					mime_type: file.type,
					size: buffer.length,
					file_path: uploadResult.file_path,
				});
				images.push({
					id: imageId,
					filename: file.name,
					mime_type: file.type,
					size: buffer.length,
					file_path: uploadResult.file_path,
					url: uploadResult.proxy_url,
					proxy_url: uploadResult.proxy_url,
				});
			} catch (uploadErr) {
				errors.push(`${file.name}: ${uploadErr.message}`);
			}
		}

		if (!images.length) {
			return json({ success: false, error: "No images were uploaded", errors }, 400);
		}
		return json({ success: true, images, errors: errors.length ? errors : undefined }, 201);
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function deleteUploadResponse(imageId) {
	try {
		const image = await getPostImage(imageId);
		if (!image || image.post_id !== "pending") return json({ success: false, error: "Image not found" }, 404);
		if (image.file_path) await deleteFileFromHub(image.file_path);
		await deletePostImage(imageId);
		return json({ success: true, message: "Image deleted" });
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function uploadImagesResponse(postId, formData) {
	try {
		const post = await getPost(postId);
		if (!post) return json({ success: false, error: "Post not found" }, 404);

		const files = formData.getAll("files");
		const customPath = String(formData.get("path") || `posts/${postId}`);
		if (!files?.length) return json({ success: false, error: "No files provided" }, 400);

		const uploadedImages = [];
		const errors = [];
		for (const file of files) {
			if (!file || typeof file.arrayBuffer !== "function") continue;
			if (!isValidImageType(file.type)) {
				errors.push(`${file.name}: Invalid file type. Only PNG, JPEG, GIF, WebP, AVIF allowed.`);
				continue;
			}
			const sizeCheck = validateFile(file);
			if (!sizeCheck.valid) {
				errors.push(`${file.name}: ${sizeCheck.error}`);
				continue;
			}
			try {
				const buffer = Buffer.from(await file.arrayBuffer());
				const uploadResult = await uploadFileToHub(buffer, customPath, file.name, file.type);
				const imageId = await createPostImage(postId, {
					filename: file.name,
					mime_type: file.type,
					size: buffer.length,
					file_path: uploadResult.file_path,
				});
				uploadedImages.push({
					id: imageId,
					filename: file.name,
					mime_type: file.type,
					size: buffer.length,
					file_path: uploadResult.file_path,
					url: uploadResult.url,
				});
			} catch (uploadErr) {
				errors.push(`${file.name}: ${uploadErr.message}`);
			}
		}

		if (!uploadedImages.length) {
			return json({ success: false, error: "No images were uploaded", errors }, 400);
		}
		return json(
			{
				success: true,
				message: `${uploadedImages.length} image(s) uploaded${errors.length ? ` (${errors.length} failed)` : ""}`,
				images: uploadedImages,
				errors: errors.length ? errors : undefined,
			},
			201
		);
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function deleteImageResponse(postId, imageId) {
	try {
		const post = await getPost(postId);
		if (!post) return json({ success: false, error: "Post not found" }, 404);
		const image = await getPostImage(imageId);
		if (!image || image.post_id !== postId) return json({ success: false, error: "Image not found for this post" }, 404);
		if (image.file_path) await deleteFileFromHub(image.file_path);
		await deletePostImage(imageId);
		return json({ success: true, message: "Image deleted" });
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function imageInfoResponse(postId, imageId) {
	try {
		const image = await getPostImage(imageId);
		if (!image || image.post_id !== postId) return json({ success: false, error: "Image not found" }, 404);
		return json({
			success: true,
			image: { ...image, proxy_url: getFileUrl(image.file_path), url: getFileUrl(image.file_path) },
		});
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function fileProxyResponse(fileId) {
	try {
		const file = await getFileFromHub(fileId);
		if (!file) return json({ success: false, error: "File not found" }, 404);
		return fileResponse(file, file.filename);
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}

export async function downloadImageResponse(postId, imageId) {
	try {
		const image = await getPostImage(imageId);
		if (!image || image.post_id !== postId) return json({ success: false, error: "Image not found" }, 404);
		const file = await getFileFromHub(image.file_path);
		if (!file) return json({ success: false, error: "Image file not found" }, 404);
		return fileResponse({ ...file, mime_type: file.mime_type || image.mime_type }, image.filename);
	} catch (err) {
		return json({ success: false, error: err.message }, 500);
	}
}
