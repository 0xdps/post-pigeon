import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2, Radio } from "lucide-react";
import { api } from "../api.js";

const PLATFORM_META = {
	twitter:  { label: "X / Twitter", color: "#000",    bg: "#e7e7e7",  initial: "𝕏",  defaultLimit: 280   },
	bluesky:  { label: "Bluesky",     color: "#0085ff", bg: "#daeeff",  initial: "Bk", defaultLimit: 300   },
	linkedin: { label: "LinkedIn",    color: "#0077b5", bg: "#dbeafe",  initial: "in", defaultLimit: 3000  },
	devto:    { label: "Dev.to",      color: "#3b49df", bg: "#eceffe",  initial: "D",  defaultLimit: null  },
	reddit:   { label: "Reddit",      color: "#ff4500", bg: "#fff0eb",  initial: "Rd", defaultLimit: 40000 },
	threads:  { label: "Threads",     color: "#8b5cf6", bg: "#f3e8ff",  initial: "Th", defaultLimit: 500   },
	github:   { label: "GitHub",      color: "#333",    bg: "#f0f0f0",  initial: "Gh", defaultLimit: null  },
};

function statusInfo(platform) {
	if (!platform.enabled) return { label: "Disabled",       color: "var(--text-3)",  icon: null };
	if (platform.auth_status === "ok")             return { label: "Connected",       color: "var(--green)",   icon: CheckCircle2 };
	if (platform.auth_status === "error")          return { label: "Auth error",      color: "var(--red)",     icon: XCircle };
	return                                                { label: "No credentials",  color: "var(--amber)",   icon: AlertTriangle };
}

function sortPlatforms(platforms) {
	const order = (p) => {
		if (p.enabled && p.auth_status === "ok")    return 0;
		if (p.enabled && p.auth_status !== "ok")    return 1;
		return 2;
	};
	return [...platforms].sort((a, b) => order(a) - order(b));
}

function PlatformRow({ platform, onToggle, onSaveLimit }) {
	const meta = PLATFORM_META[platform.key] || {
		label:        platform.key,
		color:        "var(--text)",
		bg:           "var(--bg-3)",
		initial:      platform.key?.slice(0, 2).toUpperCase(),
		defaultLimit: null,
	};

	const { label: statusLabel, color: statusColor, icon: StatusIcon } = statusInfo(platform);
	const storedLimit = platform.config?.charLimit;

	const [limitValue, setLimitValue] = useState(storedLimit != null ? String(storedLimit) : "");
	const [limitSaving, setLimitSaving] = useState(false);
	const [toggling, setToggling] = useState(false);

	// Keep local state in sync if parent updates (e.g. after refresh)
	useEffect(() => {
		setLimitValue(storedLimit != null ? String(storedLimit) : "");
	}, [storedLimit]);

	const saveLimit = async () => {
		const num = parseInt(limitValue, 10);
		const newLimit = limitValue.trim() === "" ? null : (isNaN(num) || num <= 0 ? null : num);
		// Skip if unchanged
		if (newLimit === (storedLimit ?? null)) return;
		setLimitSaving(true);
		await onSaveLimit(platform.key, { ...(platform.config || {}), charLimit: newLimit });
		setLimitSaving(false);
	};

	const handleToggle = async () => {
		setToggling(true);
		await onToggle(platform.key, !platform.enabled);
		setToggling(false);
	};

	const isCustomLimit = storedLimit != null && storedLimit !== meta.defaultLimit;
	const placeholderLimit = meta.defaultLimit != null ? String(meta.defaultLimit) : "∞";

	return (
		<div
			className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
			style={{
				background: "var(--bg-2)",
				border: "1px solid var(--border)",
				opacity: platform.enabled ? 1 : 0.55,
			}}
		>
			{/* Logo */}
			<div
				className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
				style={{ background: meta.bg, color: meta.color }}
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

			{/* Char limit */}
			<div className="flex items-center gap-1.5 ml-auto">
				<span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>limit</span>
				<div className="relative">
					<input
						type="number"
						min="1"
						value={limitValue}
						onChange={e => setLimitValue(e.target.value)}
						onBlur={saveLimit}
						onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
						placeholder={placeholderLimit}
						className="text-xs px-2 py-1 rounded-md font-mono"
						style={{
							width: "80px",
							background: "var(--bg-3)",
							border: `1px solid ${isCustomLimit ? "rgba(168,230,61,0.35)" : "var(--border-2)"}`,
							color: isCustomLimit ? "var(--accent)" : "var(--text)",
							outline: "none",
						}}
						onFocus={e => { e.currentTarget.style.borderColor = "rgba(168,230,61,0.4)"; }}
						onBlurCapture={e => { e.currentTarget.style.borderColor = isCustomLimit ? "rgba(168,230,61,0.35)" : "var(--border-2)"; }}
					/>
					{limitSaving && (
						<div className="absolute inset-y-0 right-1.5 flex items-center">
							<Loader2 size={9} className="animate-spin" style={{ color: "var(--text-3)" }} />
						</div>
					)}
				</div>
				<span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>chars</span>
			</div>

			{/* Toggle */}
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

	const handleSaveLimit = async (key, newConfig) => {
		await api.updatePlatform(key, { config: newConfig });
		setPlatforms(prev => prev.map(p => p.key === key ? { ...p, config: newConfig } : p));
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
									onSaveLimit={handleSaveLimit}
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
