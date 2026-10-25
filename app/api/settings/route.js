import config from "../../../service/core/config.js";
import { json, readJson } from "../../lib/http.js";
import { requireAuth } from "../../lib/session.js";

export async function GET() {
	const denied = await requireAuth();
	if (denied) return denied;
	return json(await config.getAllSettings());
}

export async function PATCH(request) {
	const denied = await requireAuth();
	if (denied) return denied;
	const { body, error } = await readJson(request);
	if (error) return error;
	await config.updateSettings(body);
	return json({ ok: true });
}
