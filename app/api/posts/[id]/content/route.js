import { createContentResponse, listContentResponse } from "../../../../lib/posts.js";
import { readJson } from "../../../../lib/http.js";
import { requireAuth } from "../../../../lib/session.js";

export async function GET(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { id } = await params;
	return listContentResponse(id);
}

export async function POST(request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { body, error } = await readJson(request);
	if (error) return error;
	const { id } = await params;
	return createContentResponse(id, body);
}
