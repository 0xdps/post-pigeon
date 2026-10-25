import { json, readJson } from "../../../lib/http.js";
import { COOKIE_NAME, createSessionToken, sessionCookieOptions, verifyAdminToken } from "../../../lib/session.js";

export async function POST(request) {
	const { body, error } = await readJson(request);
	if (error) return error;
	if (!body?.token) return json({ error: "token required" }, 400);

	await new Promise((resolve) => setTimeout(resolve, 300));

	let valid = false;
	try {
		valid = verifyAdminToken(body.token);
	} catch (err) {
		return json({ error: err.message }, 500);
	}
	if (!valid) return json({ error: "Invalid token" }, 401);

	const response = json({ ok: true });
	response.cookies.set(COOKIE_NAME, await createSessionToken(), sessionCookieOptions());
	return response;
}
