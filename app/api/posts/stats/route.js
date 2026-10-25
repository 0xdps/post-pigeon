import { statsResponse } from "../../../lib/posts.js";
import { requireAuth } from "../../../lib/session.js";

export async function GET() {
	const denied = await requireAuth();
	if (denied) return denied;
	return statsResponse();
}
