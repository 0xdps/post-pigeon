import { createScheduleResponse, listScheduleResponse } from "../../lib/schedule.js";
import { readJson } from "../../lib/http.js";
import { requireAuth } from "../../lib/session.js";

export async function GET(request) {
	const denied = await requireAuth();
	if (denied) return denied;
	return listScheduleResponse(request);
}

export async function POST(request) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { body, error } = await readJson(request);
	if (error) return error;
	return createScheduleResponse(body);
}
