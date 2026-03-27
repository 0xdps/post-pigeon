import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api.js";

const PLATFORM_META = {
	twitter:  { label: "X / Twitter",  color: "#60a5fa", description: "Short-form posts and threads" },
	threads:  { label: "Threads",       color: "#a78bfa", description: "Meta's text-first social platform" },
	linkedin: { label: "LinkedIn",      color: "#38bdf8", description: "Professional network posts" },
	reddit:   { label: "Reddit",        color: "#fb923c", description: "Community-based discussion posts" },
	devto:    { label: "Dev.to",        color: "#a3e635", description: "Developer-focused long-form articles" },
	github:   { label: "GitHub",        color: "#e4e4e7", description: "GitHub discussions and releases" },
	bluesky:  { label: "Bluesky",       color: "#67e8f9", description: "Decentralized microblogging" },
};

function AuthBadge({ status, enabled }) {
	if (!enabled) return (
		<span className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>disabled</span>
	);
	const styles = {
		ok:             { label: "connected",  color: "var(--green)" },
		not_configured: { label: "no credentials", color: "var(--amber)" },
		error:          { label: "auth error", color: "var(--red)"   },
	};
	const s = styles[status] || { label: status, color: "var(--text-3)" };
	return (
		<span className="text-[10px] font-mono" style={{ color: s.color }}>{s.label}</span>
	);
}

function CapBadge({ label, value }) {
	return (
		<div
			className="rounded-lg px-2.5 py-2"
			style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
		>
			<p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--text-3)" }}>{label}</p>
			<p className="text-xs font-mono" style={{ color: "var(--text-2)" }}>{value ?? "—"}</p>
		</div>
	);
}

export default function Platforms() {
	const [platforms, setPlatforms] = useState([]);
	const [loading, setLoading]     = useState(true);
	const [saving, setSaving]       = useState(false);
	const [error, setError]         = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await api.getPlatforms();
			setPlatforms(res?.platforms || []);
		} catch (err) {
			setError(err.message || "Failed to load");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, []);

	const togglePlatform = async (platform) => {
		setSaving(true);
		try {
			await api.updatePlatform(platform.key, { enabled: !platform.enabled });
			await load();
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="p-8 flex items-center gap-2 text-sm" style={{ color: "var(--text-2)" }}>
				<RefreshCw size={14} className="animate-spin" /> Loading…
			</div>
		);
	}

	const enabled  = platforms.filter((p) => p.enabled);
	const disabled = platforms.filter((p) => !p.enabled);

	return (
		<div className="p-8 max-w-3xl mx-auto animate-fade-up">

			{/* ── Header ── */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>Platforms</h1>
					<p className="text-sm mt-0.5" style={{ color: "var(--text-2)" }}>
						{enabled.length} enabled · {disabled.length} disabled
					</p>
				</div>
				<button type="button" onClick={load} className="btn-ghost" disabled={saving || loading}>
					<RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
				</button>
			</div>

			{error && (
				<div
					className="mb-5 rounded-xl px-4 py-3 text-sm"
					style={{ background: "var(--red-dim)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--red)" }}
				>
					{error}
				</div>
			)}

			<div className="space-y-3">
				{platforms.map((platform) => {
					const meta = PLATFORM_META[platform.key] || { label: platform.name, color: "var(--text-2)", description: "" };
					const authOk = platform.enabled && platform.auth_status === "ok";
					const authWarn = platform.enabled && platform.auth_status !== "ok";
					return (
						<div
							key={platform.key}
							className="rounded-xl p-5 transition-all"
							style={{
								background: "var(--bg-2)",
								border: `1px solid ${platform.enabled ? (authOk ? "rgba(74,222,128,0.12)" : authWarn ? "rgba(251,146,60,0.15)" : "var(--border)") : "var(--border)"}`,
							}}
						>
							{/* Top row */}
							<div className="flex items-start justify-between gap-4 mb-4">
								<div className="flex items-center gap-3">
									{/* Color indicator */}
									<span
										className="w-3 h-3 rounded-full shrink-0"
										style={{
											background: platform.enabled ? meta.color : "var(--border-3)",
											boxShadow:  platform.enabled && authOk ? `0 0 10px ${meta.color}50` : "none",
										}}
									/>
									<div>
										<div className="flex items-center gap-2">
											<h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>
												{meta.label}
											</h2>
											<AuthBadge status={platform.auth_status} enabled={platform.enabled} />
										</div>
										<p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{meta.description}</p>
									</div>
								</div>

								{/* Toggle button */}
								<button
									type="button"
									onClick={() => togglePlatform(platform)}
									disabled={saving}
									className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
									style={{
										background: platform.enabled ? "var(--green-dim)" : "transparent",
										color:      platform.enabled ? "var(--green)" : "var(--text-3)",
										border:     `1px solid ${platform.enabled ? "rgba(74,222,128,0.25)" : "var(--border-2)"}`,
									}}
									onMouseEnter={(e) => {
										if (!saving) {
											e.currentTarget.style.background = platform.enabled ? "var(--red-dim)" : "var(--accent-dim)";
											e.currentTarget.style.color = platform.enabled ? "var(--red)" : "var(--accent)";
											e.currentTarget.style.borderColor = platform.enabled ? "rgba(248,113,113,0.25)" : "rgba(168,230,61,0.25)";
										}
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = platform.enabled ? "var(--green-dim)" : "transparent";
										e.currentTarget.style.color = platform.enabled ? "var(--green)" : "var(--text-3)";
										e.currentTarget.style.borderColor = platform.enabled ? "rgba(74,222,128,0.25)" : "var(--border-2)";
									}}
								>
									{platform.enabled ? "Enabled" : "Enable"}
								</button>
							</div>

							{/* Capabilities */}
							<div className="grid grid-cols-4 gap-2">
								<CapBadge label="Max chars"   value={platform.catalog?.capabilities?.maxCharacters} />
								<CapBadge label="Thread"      value={platform.catalog?.capabilities?.supportsThread ? "Yes" : "No"} />
								<CapBadge label="Images"      value={platform.catalog?.capabilities?.supportsImages ? "Yes" : "No"} />
								<CapBadge label="Max images"  value={platform.catalog?.capabilities?.maxImagesPerPost} />
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
