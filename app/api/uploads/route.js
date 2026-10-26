import { uploadFilesResponse } from "../../lib/images.js";
import { requireAuth } from "../../lib/session.js";

export async function POST(request) {
	const denied = await requireAuth();
	if (denied) return denied;
	return uploadFilesResponse(await request.formData());
}
