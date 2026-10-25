import { cancelScheduleResponse, getScheduleResponse } from "../../../lib/schedule.js";
import { requireAuth } from "../../../lib/session.js";

export async function GET(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { id } = await params;
	return getScheduleResponse(id);
}

export async function DELETE(_request, { params }) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { id } = await params;
	return cancelScheduleResponse(id);
}
