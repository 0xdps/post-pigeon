import { Hono } from "hono";
import { createSession, clearSession, verifyAdminToken } from "../middleware/auth.js";

const router = new Hono();

router.post("/login", async (c) => {
	let body;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: "Invalid JSON" }, 400);
	}

	const { token } = body;
	if (!token) return c.json({ error: "token required" }, 400);

	// Slow down brute-force attempts
	await new Promise((r) => setTimeout(r, 300));

	let valid = false;
	try {
		valid = verifyAdminToken(token);
	} catch (err) {
		return c.json({ error: err.message }, 500);
	}

	if (!valid) return c.json({ error: "Invalid token" }, 401);

	await createSession(c);
	return c.json({ ok: true });
});

router.post("/logout", (c) => {
	clearSession(c);
	return c.json({ ok: true });
});

export default router;
