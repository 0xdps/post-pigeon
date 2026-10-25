import { listPlatformsResponse } from "../../lib/platforms.js";
import { requireAuth } from "../../lib/session.js";

export async function GET() {
	const denied = await requireAuth();
	if (denied) return denied;
	return listPlatformsResponse();
}
