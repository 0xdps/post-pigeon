import { deleteImageResponse } from "../../../../../lib/images.js";
import { requireAuth } from "../../../../../lib/session.js";

export async function DELETE(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { id, imageId } = await params;
	return deleteImageResponse(id, imageId);
}
