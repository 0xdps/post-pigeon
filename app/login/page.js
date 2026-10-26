"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
	const router = useRouter();
	const [token, setToken] = useState("");
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);

	async function onSubmit(event) {
		event.preventDefault();
		setPending(true);
		setError("");
		const res = await fetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token }),
		});
		setPending(false);
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			setError(body.error || "Login failed");
			return;
		}
		router.push("/overview");
		router.refresh();
	}

	return (
		<main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
			<form onSubmit={onSubmit} style={{ width: 380, display: "grid", gap: 14 }}>
				<img src="/logo-transparent.png" alt="" width={72} height={72} />
				<div>
					<p className="kicker">PostPigeon</p>
					<h1>Open the desk</h1>
				</div>
				<input
					type="password"
					value={token}
					onChange={(event) => setToken(event.target.value)}
					placeholder="Admin token"
					autoFocus
					required
					style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line)", background: "white" }}
				/>
				<button className="btn btn-sky" disabled={pending}>{pending ? "Checking…" : "Continue"}</button>
				{error ? <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p> : null}
			</form>
		</main>
	);
}
