import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2, Radio, Check } from "lucide-react";
import { api } from "../api.js";

const CHANNEL_META = {
	twitter:  { label: "X / Twitter",  color: "#000",    bg: "#e7e7e7",  initial: "𝕏",  description: "Short-form posts, threads, and replies",     defaultLimit: 280   },
	bluesky:  { label: "Bluesky",      color: "#0085ff", bg: "#daeeff",  initial: "Bk", description: "Decentralized microblogging on ATProtocol",   defaultLimit: 300   },
	linkedin: { label: "LinkedIn",     color: "#0077b5", bg: "#dbeafe",  initial: "in", description: "Professional posts and long-form content",    defaultLimit: 3000  },
	devto:    { label: "Dev.to",       color: "#3b49df", bg: "#eceffe",  initial: "D",  description: "Developer articles with markdown support",    defaultLimit: null  },
	reddit:   { label: "Reddit",       color: "#ff4500", bg: "#fff0eb",  initial: "Rd", description: "Community posts to specific subreddits",      defaultLimit: 40000 },
	threads:  { label: "Threads",      color: "#8b5cf6", bg: "#f3e8ff",  initial: "Th", description: "Meta's text-first social network",            defaultLimit: 500   },
	github:   { label: "GitHub",       color: "#333",    bg: "#f0f0f0",  initial: "Gh", description: "Discussions, releases, and gist posts",       defaultLimit: null  },
};

function AuthStatus({ status, enabled }) {
	if (!enabled) {
		return (
			<div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
				<span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--border-2)" }} />
				Disabled
			</div>
		);
	}
	const cfg = {
		ok:             { label: "Connected",      color: "var(--green)" },
		not_configured: { label: "No credentials", color: "var(--amber)" },
		error:          { label: "Auth error",     color: "var(--red)"   },
	}[status] || { label: status, color: "var(--text-3)" };

	const Icon = status === "ok" ? CheckCircle2 : status === "error" ? XCircle : AlertTriangle;
	return (
		<div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: cfg.color }}>
			<Icon size={12} />
			{cfg.label}
		</div>
	);
}

function CharLimitField({ platformKey, config, onSave }) {
	const meta = CHANNEL_META[platformKey];
	const storedLimit = config?.charLimit;
	const [value, setValue] = useState(storedLimit != null ? String(storedLimit) : "");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const handleSave = async () => {
		const num = parseInt(value, 10);
		const newLimit = value.trim() === "" ? null : (isNaN(num) || num <= 0 ? null : num);
		setSaving(true);
		await onSave(platformKey, { ...config, charLimit: newLimit });
		setSaving(false);
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	};

	const handleKeyDown = (e) => {
		if (e.key === "Enter") handleSave();
	};

	return (
		<div className="flex items-center gap-2 mt-2">
			<span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>Char limit</span>
			<div className="flex items-center gap-1.5">
				<input
					type="number"
					min="1"
					value={value}
					onChange={e => setValue(e.target.value)}
					onBlur={handleSave}
					onKeyDown={handleKeyDown}
					placeholder={meta?.defaultLimit != null ? String(meta.defaultLimit) : "No limit"}
					className="text-xs px-2 py-1 rounded-md font-mono"
					style={{
						width: "90px",
						background: "var(--bg-3)",
						border: "1px solid var(--border-2)",
						color: "var(--text)",
						outline: "none",
					}}
					onFocus={e => { e.currentTarget.style.borderColor = "rgba(168,230,61,0.4)"; }}
					onBlurCapture={e => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
				/>
				{saving && <Loader2 size={11} className="animate-spin" style={{ color: "var(--text-3)" }} />}
				{saved && <Check size={11} style={{ color: "var(--green)" }} />}
			</div>
			{meta?.defaultLimit != null && (
				<span className="text-[10px]" style={{ color: "var(--text-3)" }}>
					default: {meta.defaultLimit.toLocaleString()}
				</span>
			)}
			{storedLimit != null && storedLimit !== meta?.defaultLimit && (
				<span
					className="text-[10px] px-1.5 py-0.5 rounded font-mono"
					style={{ background: "var(--accent-dim2)", color: "var(--accent)" }}
				>
					custom
				</span>
			)}
		</div>
	);
}

function ChannelCard({ platform, onToggle, onUpdateConfig }) {
	const meta = CHANNEL_META[platform.key] || {
		label: platform.key,
		color: "var(--text)",
		bg: "var(--bg-3)",
		initial: platform.key?.slice(0, 2).toUpperCase(),
		description: "",
		defaultLimit: null,
	};

	const [toggling, setToggling] = useState(false);
	const isConnected = platform.enabled && platform.auth_status === "ok";

	const handleToggle = async () => {
		setToggling(true);
		await onToggle(platform.key, !platform.enabled);
		setToggling(false);
	};

	return (
		<div
			className="rounded-xl transition-all"
			style={{
				background: "var(--bg-2)",
				border: `1px solid ${platform.enabled && isConnected ? "rgba(52,211,153,0.15)" : "var(--border)"}`,
				opacity: platform.enabled ? 1 : 0.65,
			}}
		>
			<div className="flex items-center gap-4 p-4">
				{/* Platform logo */}
				<div
					className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
					style={{ background: meta.bg, color: meta.color }}
				>
					{meta.initial}
				</div>

				{/* Info */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-0.5">
						<span className="text-sm font-bold" style={{ color: "var(--text)" }}>{meta.label}</span>
					</div>
					<p className="text-xs" style={{ color: "var(--text-3)" }}>{meta.description}</p>
					<div className="mt-1">
						<AuthStatus status={platform.auth_status} enabled={platform.enabled} />
					</div>
				</div>

				{/* Toggle */}
				<div className="shrink-0">
					{platform.enabled && platform.auth_status === "not_configured" && (
						<span className="text-xs mr-3" style={{ color: "var(--amber)" }}>Configure credentials</span>
					)}
					<button
						onClick={handleToggle}
						disabled={toggling}
						className="relative w-10 h-5 rounded-full transition-all"
						style={{ background: platform.enabled ? "var(--accent)" : "var(--bg-4)", cursor: "pointer" }}
						aria-label={`${platform.enabled ? "Disable" : "Enable"} ${meta.label}`}
					>
						{toggling ? (
							<div className="absolute inset-0 flex items-center justify-center">
								<Loader2 size={10} className="animate-spin" style={{ color: platform.enabled ? "#080808" : "var(--text-3)" }} />
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
			</div>

			{/* Char limit — shown for all platforms */}
			<div className="px-4 pb-3" style={{ borderTop: "1px solid var(--border)" }}>
				<CharLimitField
					platformKey={platform.key}
					config={platform.config || {}}
					onSave={onUpdateConfig}
				/>
			</div>
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

	const handleUpdateConfig = async (key, newConfig) => {
		await api.updatePlatform(key, { config: newConfig });
		setPlatforms(prev => prev.map(p => p.key === key ? { ...p, config: newConfig } : p));
	};

	const connected = platforms.filter(p => p.enabled && p.auth_status === "ok").length;
	const total = platforms.length;

	return (
		<div className="min-h-full" style={{ background: "var(--bg)" }}>
			<div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
				<div className="px-8 py-6">
					<div className="flex items-start justify-between">
						<div>
							<h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Platforms</h1>
							<p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
								{loading ? "Loading…" : `${connected} of ${total} platforms connected · char limits apply in Compose`}
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
						<p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>Platforms are configured in the service settings.</p>
					</div>
				) : (
					<div className="max-w-2xl space-y-3">
						{platforms.filter(p => p.enabled && p.auth_status === "ok").length > 0 && (
							<div className="mb-6">
								<p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--green)" }}>Connected</p>
								<div className="space-y-2">
									{platforms.filter(p => p.enabled && p.auth_status === "ok")
										.map(p => <ChannelCard key={p.key} platform={p} onToggle={handleToggle} onUpdateConfig={handleUpdateConfig} />)}
								</div>
							</div>
						)}
						{platforms.filter(p => p.enabled && p.auth_status !== "ok").length > 0 && (
							<div className="mb-6">
								<p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--amber)" }}>Needs attention</p>
								<div className="space-y-2">
									{platforms.filter(p => p.enabled && p.auth_status !== "ok")
										.map(p => <ChannelCard key={p.key} platform={p} onToggle={handleToggle} onUpdateConfig={handleUpdateConfig} />)}
								</div>
							</div>
						)}
						{platforms.filter(p => !p.enabled).length > 0 && (
							<div>
								<p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--text-3)" }}>Available</p>
								<div className="space-y-2">
									{platforms.filter(p => !p.enabled)
										.map(p => <ChannelCard key={p.key} platform={p} onToggle={handleToggle} onUpdateConfig={handleUpdateConfig} />)}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
