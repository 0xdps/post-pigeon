import { createClient } from "../../../../service/posting/twitter-client.js";
import { json } from "../../../lib/http.js";
import { requireAuth } from "../../../lib/session.js";

export async function GET() {
	const denied = await requireAuth();
	if (denied) return denied;

	try {
		const client = await createClient();
		const res = await client.v2.me();
		return json({
			ok: true,
			status: "ok",
			user: { id: res?.data?.id, username: res?.data?.username },
			ts: Date.now(),
		});
	} catch (err) {
		const code = Number(err?.code || err?.status || err?.statusCode || err?.data?.status);
		const title = err?.data?.title || err?.title || "Request failed";
		const detail = err?.data?.detail || err?.message || "No detail available";
		const type = err?.data?.type || err?.type || "unknown";
		const status = code === 401 || code === 403 ? "auth_error" : [429, 502, 503, 504].includes(code) ? "service_unavailable" : "unknown_error";
		return json({
			ok: false,
			status,
			code: Number.isFinite(code) ? code : null,
			title,
			detail,
			type,
			ts: Date.now(),
		});
	}
}
