import { NextResponse } from "next/server";

export function json(data, status = 200) {
	return NextResponse.json(data, { status });
}

export async function readJson(request) {
	try {
		return { body: await request.json() };
	} catch {
		return { error: json({ error: "Invalid JSON" }, 400) };
	}
}
