import { listImagesResponse, uploadImagesResponse } from "../../../../lib/images.js";
import { requireAuth } from "../../../../lib/session.js";

export async function GET(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { id } = await params;
	return listImagesResponse(id);
}

export async function POST(request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { id } = await params;
	return uploadImagesResponse(id, await request.formData());
}
