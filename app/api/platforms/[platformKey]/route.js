import { updatePlatformResponse } from "../../../lib/platforms.js";
import { readJson } from "../../../lib/http.js";
import { requireAuth } from "../../../lib/session.js";

export async function PATCH(request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { body, error } = await readJson(request);
	if (error) return error;
	const { platformKey } = await params;
	return updatePlatformResponse(platformKey, body);
}
