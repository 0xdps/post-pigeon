import { deleteUploadResponse } from "../../../lib/images.js";
import { requireAuth } from "../../../lib/session.js";

export async function DELETE(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { imageId } = await params;
	return deleteUploadResponse(imageId);
}
