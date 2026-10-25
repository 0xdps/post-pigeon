import { listJobsResponse } from "../../../lib/platforms.js";
import { requireAuth } from "../../../lib/session.js";

export async function GET(request) {
	const denied = await requireAuth();
	if (denied) return denied;
	return listJobsResponse(request);
}
