import { deleteContentResponse, updateContentResponse } from "../../../../../lib/posts.js";
import { readJson } from "../../../../../lib/http.js";
import { requireAuth } from "../../../../../lib/session.js";

export async function PUT(request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { body, error } = await readJson(request);
	if (error) return error;
	const { contentId } = await params;
	return updateContentResponse(contentId, body);
}

export async function DELETE(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { contentId } = await params;
	return deleteContentResponse(contentId);
}
