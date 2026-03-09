import { SignJWT, jwtVerify } from "jose";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { timingSafeEqual } from "crypto";

const COOKIE_NAME = "x_session";
const ALG = "HS256";

function getSecret() {
	const s = process.env.SESSION_SECRET;
	if (!s) throw new Error("SESSION_SECRET env var is required");
	return new TextEncoder().encode(s);
}

export async function createSession(c) {
	const token = await new SignJWT({ admin: true })
		.setProtectedHeader({ alg: ALG })
		.setIssuedAt()
		.setExpirationTime("7d")
		.sign(getSecret());

	setCookie(c, COOKIE_NAME, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "Lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 7,
	});
}

export function clearSession(c) {
	deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export async function authMiddleware(c, next) {
	const token = getCookie(c, COOKIE_NAME);
	if (!token) return c.json({ error: "Unauthorized" }, 401);
	try {
		await jwtVerify(token, getSecret());
		return next();
	} catch {
		return c.json({ error: "Unauthorized" }, 401);
	}
}

export function verifyAdminToken(provided) {
	const expected = process.env.ADMIN_TOKEN;
	if (!expected) throw new Error("ADMIN_TOKEN env var is required");
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}
