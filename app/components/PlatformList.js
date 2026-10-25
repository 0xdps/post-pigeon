"use client";

import { useRouter } from "next/navigation";
import { api } from "../lib/client.js";

const META = {
	twitter: { label: "X", note: "Posts, threads, and images." },
	linkedin: { label: "LinkedIn", note: "Stub. First post only." },
	threads: { label: "Threads", note: "Stub. First post only." },
	devto: { label: "Dev.to", note: "Stub. First post becomes the article." },
	reddit: { label: "Reddit", note: "API access is restricted for new apps." },
	bluesky: { label: "Bluesky", note: "Not connected yet." },
};

function labelFor(platform) {
	if (platform.key === "reddit") return "Restricted";
	if (!platform.enabled) return "Off";
	if (platform.auth_status === "ok") return "Connected";
	if (platform.auth_status === "configured") return "Credentials set";
	if (platform.auth_status === "error") return "Auth error";
	return "No credentials";
}

export default function PlatformList({ platforms, username }) {
	const router = useRouter();

	async function toggle(platform) {
		await api.updatePlatform(platform.key, { enabled: !platform.enabled });
		router.refresh();
	}

	return (
		<div className="library">
			{platforms.map((platform) => (
				<article key={platform.key} className="post-card">
					<div>
						<div className="meta">
							<span className={`pill ${platform.enabled ? "ok" : ""}`}>{labelFor(platform)}</span>
							{platform.key === "twitter" && username ? <span>@{username}</span> : null}
						</div>
						<strong>{META[platform.key]?.label || platform.name}</strong>
						<p>{META[platform.key]?.note}</p>
					</div>
					<button type="button" className={platform.enabled ? "btn-ghost" : "btn"} onClick={() => toggle(platform)}>
						{platform.enabled ? "Turn off" : "Turn on"}
					</button>
				</article>
			))}
		</div>
	);
}
