import { fileProxyResponse } from "../../../../lib/images.js";
import { requireAuth } from "../../../../lib/session.js";

export async function GET(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { fileId } = await params;
	return fileProxyResponse(fileId);
}
