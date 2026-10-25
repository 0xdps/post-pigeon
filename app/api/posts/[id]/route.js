import { deletePostResponse, getPostResponse, updatePostResponse } from "../../../lib/posts.js";
import { readJson } from "../../../lib/http.js";
import { requireAuth } from "../../../lib/session.js";

export async function GET(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { id } = await params;
	return getPostResponse(id);
}

export async function PUT(request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { body, error } = await readJson(request);
	if (error) return error;
	const { id } = await params;
	return updatePostResponse(id, body);
}

export async function DELETE(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { id } = await params;
	return deletePostResponse(id);
}
