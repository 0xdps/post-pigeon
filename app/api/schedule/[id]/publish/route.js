import { publishNowResponse } from "../../../../lib/schedule.js";
import { requireAuth } from "../../../../lib/session.js";

export async function POST(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { id } = await params;
	return publishNowResponse(id);
}
