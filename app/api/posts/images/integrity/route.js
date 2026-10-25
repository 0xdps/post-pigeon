import { imagesIntegrityResponse } from "../../../../lib/images.js";
import { requireAuth } from "../../../../lib/session.js";

export async function GET() {
	const denied = await requireAuth();
	if (denied) return denied;
	return imagesIntegrityResponse();
}
