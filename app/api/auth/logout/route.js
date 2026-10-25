import { json } from "../../../lib/http.js";
import { COOKIE_NAME } from "../../../lib/session.js";

export async function POST() {
	const response = json({ ok: true });
	response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
	return response;
}
