import { planResponse } from "../../../lib/platforms.js";
import { readJson } from "../../../lib/http.js";
import { requireAuth } from "../../../lib/session.js";

export async function POST(request) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { body, error } = await readJson(request);
	if (error) return error;
	return planResponse(body);
}
