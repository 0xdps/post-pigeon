import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2, Radio, Ban } from "lucide-react";
import { api } from "../api.js";

const PLATFORM_META = {
	twitter: {
		label: "X / Twitter", color: "#000", bg: "#e7e7e7", initial: "𝕏",
		requiredVars: ["TWITTER_API_KEY", "TWITTER_API_KEY_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_TOKEN_SECRET"],
	},
	bluesky: {
		label: "Bluesky", color: "#0085ff", bg: "#daeeff", initial: "Bk",
		requiredVars: ["BLUESKY_IDENTIFIER", "BLUESKY_APP_PASSWORD"],
	},
	linkedin: {
		label: "LinkedIn", color: "#0077b5", bg: "#dbeafe", initial: "in",
		requiredVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_PERSON_URN"],
	},
	devto: {
		label: "Dev.to", color: "#3b49df", bg: "#eceffe", initial: "D",
		requiredVars: ["DEVTO_API_KEY"],
	},
	reddit: {
		label: "Reddit", color: "#ff4500", bg: "#fff0eb", initial: "Rd",
		requiredVars: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USERNAME", "REDDIT_PASSWORD", "REDDIT_USER_AGENT"],
		restricted: true,
		restrictedReason: "Reddit disabled self-serve API access for new developers in late 2024. New apps require manual approval from Reddit, which is rarely granted. Support will be added if Reddit reopens API access.",
	},
	threads: {
		label: "Threads", color: "#8b5cf6", bg: "#f3e8ff", initial: "Th",
		requiredVars: ["THREADS_APP_ID", "THREADS_APP_SECRET", "THREADS_ACCESS_TOKEN", "THREADS_USER_ID"],
	},
};

function statusInfo(platform) {
	const meta = PLATFORM_META[platform.key];
	if (meta?.restricted)                              return { label: "API access restricted", color: "var(--text-3)",  icon: Ban };
	if (!platform.enabled)                             return { label: "Disabled",              color: "var(--text-3)",  icon: null };
	if (platform.auth_status === "ok")                 return { label: "Connected",             color: "var(--green)",   icon: CheckCircle2 };
	if (platform.auth_status === "configured")         return { label: "Credentials set",       color: "var(--accent)",  icon: CheckCircle2 };
	if (platform.auth_status === "error")              return { label: "Auth error",            color: "var(--red)",     icon: XCircle };
	return                                                    { label: "No credentials",        color: "var(--amber)",   icon: AlertTriangle };
}

function sortPlatforms(platforms) {
	const order = (p) => {
		if (PLATFORM_META[p.key]?.restricted)                                      return 3;
		if (p.enabled && (p.auth_status === "ok" || p.auth_status === "configured")) return 0;
		if (p.enabled)                                                             return 1;
		return 2;
	};
	return [...platforms].sort((a, b) => order(a) - order(b));
}

function PlatformRow({ platform, onToggle }) {
	const meta = PLATFORM_META[platform.key] || {
		label:   platform.key,
		color:   "var(--text)",
		bg:      "var(--bg-3)",
		initial: platform.key?.slice(0, 2).toUpperCase(),
	};

	const { label: statusLabel, color: statusColor, icon: StatusIcon } = statusInfo(platform);
	const [toggling, setToggling] = useState(false);

	const handleToggle = async () => {
		setToggling(true);
		await onToggle(platform.key, !platform.enabled);
		setToggling(false);
	};

	const isRestricted    = !!meta.restricted;
	const isNotConfigured = !isRestricted && platform.auth_status === "not_configured";

	return (
		<div
			className="rounded-xl transition-all overflow-hidden"
			style={{
				background: "var(--bg-2)",
				border: `1px solid ${isRestricted ? "var(--border)" : "var(--border)"}`,
				opacity: isRestricted ? 0.6 : (platform.enabled ? 1 : 0.55),
			}}
		>
			<div className="flex items-center gap-3 px-4 py-3">
				{/* Logo */}
				<div
					className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
					style={{ background: meta.bg, color: meta.color, filter: isRestricted ? "grayscale(0.5)" : "none" }}
				>
					{meta.initial}
				</div>

				{/* Name */}
				<span className="text-sm font-semibold w-28 shrink-0" style={{ color: "var(--text)" }}>
					{meta.label}
				</span>

				{/* Status pill */}
				<div className="flex items-center gap-1.5 w-36 shrink-0">
					{StatusIcon
						? <StatusIcon size={11} style={{ color: statusColor }} />
						: <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--border-2)" }} />
					}
					<span className="text-xs" style={{ color: statusColor }}>{statusLabel}</span>
				</div>

			{/* Toggle — disabled for restricted or unconfigured platforms */}
			{isRestricted ? (
				<div className="ml-auto shrink-0">
					<span
						className="text-[10px] px-2 py-1 rounded font-medium"
						style={{ background: "var(--bg-4)", color: "var(--text-3)", border: "1px solid var(--border-2)" }}
					>
						Unavailable
					</span>
				</div>
			) : isNotConfigured ? (
				<div className="ml-auto shrink-0" title="Set required ENV vars to enable">
					<span
						className="text-[10px] px-2 py-1 rounded font-medium"
						style={{ background: "var(--bg-4)", color: "var(--text-3)", border: "1px solid var(--border-2)" }}
					>
						Not configured
					</span>
				</div>
			) : (
				<button
					onClick={handleToggle}
					disabled={toggling}
					className="relative w-9 h-5 rounded-full transition-all shrink-0 ml-3"
					style={{ background: platform.enabled ? "var(--accent)" : "var(--bg-4)", cursor: "pointer" }}
					aria-label={`${platform.enabled ? "Disable" : "Enable"} ${meta.label}`}
				>
					{toggling ? (
						<div className="absolute inset-0 flex items-center justify-center">
							<Loader2 size={9} className="animate-spin" style={{ color: platform.enabled ? "#080808" : "var(--text-3)" }} />
						</div>
					) : (
						<span
							className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
							style={{
								left: platform.enabled ? "calc(100% - 18px)" : "2px",
								background: platform.enabled ? "#080808" : "var(--text-3)",
							}}
						/>
					)}
				</button>
			)}
			</div>

			{/* Restriction notice */}
			{isRestricted && (
				<div
					className="px-4 py-2 text-xs leading-relaxed"
					style={{ borderTop: "1px solid var(--border)", color: "var(--text-3)", background: "var(--bg-3)" }}
				>
					{meta.restrictedReason}
				</div>
			)}

			{/* Required ENV vars — shown when not configured */}
			{isNotConfigured && meta.requiredVars?.length > 0 && (
				<div
					className="px-4 py-2.5"
					style={{ borderTop: "1px solid var(--border)", background: "var(--bg-3)" }}
				>
					<p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-3)" }}>
						Required ENV vars
					</p>
					<div className="flex flex-wrap gap-1.5">
						{meta.requiredVars.map(v => (
							<code
								key={v}
								className="text-[10px] px-1.5 py-0.5 rounded font-mono"
								style={{ background: "var(--bg-4)", color: "var(--amber)", border: "1px solid var(--border-2)" }}
							>
								{v}
							</code>
						))}
					</div>
					<p className="text-[10px] mt-1.5" style={{ color: "var(--text-3)" }}>
						Add these to your <code className="font-mono" style={{ color: "var(--text-2)" }}>.env</code> file and restart the service. See the <a href="/guide" className="underline" style={{ color: "var(--accent)" }}>Setup Guide</a> for details.
					</p>
				</div>
			)}
		</div>
	);
}

export default function Channels() {
	const [platforms, setPlatforms] = useState([]);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		const res = await api.getPlatforms();
		const arr = Array.isArray(res) ? res : (res?.platforms || []);
		setPlatforms(arr);
		setLoading(false);
	};

	useEffect(() => { load(); }, []);

	const handleToggle = async (key, enabled) => {
		await api.updatePlatform(key, { enabled });
		setPlatforms(prev => prev.map(p => p.key === key ? { ...p, enabled } : p));
	};

	const connected = platforms.filter(p => p.enabled && p.auth_status === "ok").length;
	const total = platforms.length;
	const sorted = sortPlatforms(platforms);

	return (
		<div className="min-h-full" style={{ background: "var(--bg)" }}>
			{/* Header */}
			<div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
				<div className="px-8 py-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Platforms</h1>
							<p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
								{loading ? "Loading…" : `${connected} of ${total} connected · char limits apply when composing`}
							</p>
						</div>
						<button onClick={load} className="btn-icon" title="Refresh">
							<RefreshCw size={14} />
						</button>
					</div>
				</div>
			</div>

			<div className="px-8 py-6">
				{loading ? (
					<div className="flex items-center justify-center py-24">
						<Loader2 size={20} className="animate-spin" style={{ color: "var(--text-3)" }} />
					</div>
				) : platforms.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-24 text-center">
						<Radio size={32} style={{ color: "var(--text-3)" }} className="mb-3" />
						<p className="font-medium" style={{ color: "var(--text-2)" }}>No platforms configured</p>
						<p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>Platforms are seeded automatically on service startup.</p>
					</div>
				) : (
					<div className="max-w-2xl">
						{/* Column headers */}
						<div className="flex items-center gap-3 px-4 pb-2 mb-1">
							<div className="w-8 shrink-0" />
							<span className="text-[10px] font-bold uppercase tracking-widest w-28 shrink-0" style={{ color: "var(--text-3)" }}>Platform</span>
							<span className="text-[10px] font-bold uppercase tracking-widest w-36 shrink-0" style={{ color: "var(--text-3)" }}>Status</span>
							<span className="text-[10px] font-bold uppercase tracking-widest ml-auto" style={{ color: "var(--text-3)" }}>Char limit</span>
							<span className="text-[10px] font-bold uppercase tracking-widest w-9 ml-3 text-center shrink-0" style={{ color: "var(--text-3)" }}>On</span>
						</div>

						<div className="space-y-1.5">
							{sorted.map(p => (
								<PlatformRow
									key={p.key}
									platform={p}
									onToggle={handleToggle}
								/>
							))}
						</div>

						<p className="text-xs mt-4" style={{ color: "var(--text-3)" }}>
							Char limit overrides the platform default in the Compose editor. Leave blank to use the default.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
