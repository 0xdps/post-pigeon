import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const COOKIE_NAME = "x_session";
const ALG = "HS256";

function getSecret() {
	const secret = process.env.SESSION_SECRET;
	if (!secret) throw new Error("SESSION_SECRET env var is required");
	return new TextEncoder().encode(secret);
}

export function verifyAdminToken(provided) {
	const expected = process.env.ADMIN_TOKEN;
	if (!expected) throw new Error("ADMIN_TOKEN env var is required");
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

export async function createSessionToken() {
	return new SignJWT({ admin: true })
		.setProtectedHeader({ alg: ALG })
		.setIssuedAt()
		.setExpirationTime("7d")
		.sign(getSecret());
}

export function sessionCookieOptions() {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 7,
	};
}

export async function isAuthenticated() {
	const token = (await cookies()).get(COOKIE_NAME)?.value;
	if (!token) return false;
	try {
		await jwtVerify(token, getSecret());
		return true;
	} catch {
		return false;
	}
}

export async function requireAuth() {
	if (await isAuthenticated()) return null;
	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
