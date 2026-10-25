import { json } from "../../lib/http.js";

export function GET() {
	return json({ ok: true, ts: Date.now() });
}
