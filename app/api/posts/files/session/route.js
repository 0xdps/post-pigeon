import { filesSessionResponse } from "../../../../lib/images.js";
import { requireAuth } from "../../../../lib/session.js";

export async function POST() {
	const denied = await requireAuth();
	if (denied) return denied;
	return filesSessionResponse();
}
