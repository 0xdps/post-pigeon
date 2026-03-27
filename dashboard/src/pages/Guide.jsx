import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Ban, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { api } from "../api.js";

const PLATFORM_SETUP = [
	{
		key:      "twitter",
		label:    "X / Twitter",
		initial:  "𝕏",
		bg:       "#e7e7e7",
		color:    "#000",
		docsUrl:  null,
		vars: [
			{ name: "TWITTER_API_KEY",              desc: "Consumer / API Key" },
			{ name: "TWITTER_API_KEY_SECRET",        desc: "Consumer / API Key Secret" },
			{ name: "TWITTER_ACCESS_TOKEN",          desc: "Access Token (for the posting account)" },
			{ name: "TWITTER_ACCESS_TOKEN_SECRET",   desc: "Access Token Secret" },
		],
		howTo: "developer.twitter.com → your app → Keys and Tokens. App permissions must be Read and Write.",
	},
	{
		key:     "linkedin",
		label:   "LinkedIn",
		initial: "in",
		bg:      "#dbeafe",
		color:   "#0077b5",
		vars: [
			{ name: "LINKEDIN_CLIENT_ID",      desc: "App Client ID" },
			{ name: "LINKEDIN_CLIENT_SECRET",  desc: "App Client Secret" },
			{ name: "LINKEDIN_ACCESS_TOKEN",   desc: "OAuth 2.0 access token (60-day expiry)" },
			{ name: "LINKEDIN_PERSON_URN",     desc: "urn:li:person:XXXXXX — from GET /v2/userinfo" },
		],
		howTo: "linkedin.com/developers → Create app → add Share on LinkedIn product → run OAuth flow.",
	},
	{
		key:     "threads",
		label:   "Threads (Meta)",
		initial: "Th",
		bg:      "#f3e8ff",
		color:   "#8b5cf6",
		vars: [
			{ name: "THREADS_APP_ID",       desc: "Meta App ID" },
			{ name: "THREADS_APP_SECRET",   desc: "Meta App Secret" },
			{ name: "THREADS_ACCESS_TOKEN", desc: "OAuth 2.0 access token (60-day expiry)" },
			{ name: "THREADS_USER_ID",      desc: "Numeric Threads user ID — from GET /v1.0/me" },
		],
		howTo: "developers.facebook.com → Create app → add Threads API product → run OAuth flow.",
	},
	{
		key:     "devto",
		label:   "Dev.to",
		initial: "D",
		bg:      "#eceffe",
		color:   "#3b49df",
		vars: [
			{ name: "DEVTO_API_KEY", desc: "Personal API key (permanent, no expiry)" },
		],
		howTo: "dev.to/settings/extensions → DEV API Keys → Generate API Key.",
	},
	{
		key:      "reddit",
		label:    "Reddit",
		initial:  "Rd",
		bg:       "#fff0eb",
		color:    "#ff4500",
		restricted: true,
		vars: [
			{ name: "REDDIT_CLIENT_ID",     desc: "Script app client ID" },
			{ name: "REDDIT_CLIENT_SECRET", desc: "Script app client secret" },
			{ name: "REDDIT_USERNAME",      desc: "Reddit account username" },
			{ name: "REDDIT_PASSWORD",      desc: "Reddit account password (2FA must be off)" },
			{ name: "REDDIT_USER_AGENT",    desc: "e.g. script:PostPigeon:v1.0 (by /u/username)" },
		],
		howTo: "Reddit has disabled self-serve API access for new developers. Manual approval required.",
	},
];

function CopyButton({ text }) {
	const [copied, setCopied] = useState(false);
	const handle = () => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};
	return (
		<button
			onClick={handle}
			className="p-1 rounded transition-all"
			style={{ color: copied ? "var(--green)" : "var(--text-3)" }}
			title="Copy"
		>
			{copied ? <Check size={11} /> : <Copy size={11} />}
		</button>
	);
}

function PlatformCard({ setup, authStatus, enabled }) {
	const isRestricted    = !!setup.restricted;
	const isConfigured    = authStatus === "configured" || authStatus === "ok";
	const isMissing       = !isConfigured && !isRestricted;

	const statusEl = isRestricted ? (
		<div className="flex items-center gap-1.5">
			<Ban size={11} style={{ color: "var(--text-3)" }} />
			<span className="text-xs" style={{ color: "var(--text-3)" }}>API access restricted</span>
		</div>
	) : isConfigured ? (
		<div className="flex items-center gap-1.5">
			<CheckCircle2 size={11} style={{ color: "var(--green)" }} />
			<span className="text-xs font-medium" style={{ color: "var(--green)" }}>Credentials set</span>
		</div>
	) : (
		<div className="flex items-center gap-1.5">
			<AlertTriangle size={11} style={{ color: "var(--amber)" }} />
			<span className="text-xs font-medium" style={{ color: "var(--amber)" }}>Missing credentials</span>
		</div>
	);

	return (
		<div
			className="rounded-xl overflow-hidden"
			style={{
				border: `1px solid ${isConfigured && !isRestricted ? "rgba(74,222,128,0.15)" : "var(--border)"}`,
				background: "var(--bg-2)",
				opacity: isRestricted ? 0.6 : 1,
			}}
		>
			{/* Header */}
			<div className="flex items-center gap-3 px-4 py-3">
				<div
					className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
					style={{ background: setup.bg, color: setup.color }}
				>
					{setup.initial}
				</div>
				<div className="flex-1">
					<p className="text-sm font-bold" style={{ color: "var(--text)" }}>{setup.label}</p>
					<p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{setup.howTo}</p>
				</div>
				{statusEl}
			</div>

			{/* Vars table */}
			<div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-3)" }}>
				{setup.vars.map((v, i) => (
					<div
						key={v.name}
						className="flex items-center gap-3 px-4 py-2"
						style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
					>
						<code
							className="text-[11px] font-mono w-64 shrink-0"
							style={{ color: isRestricted ? "var(--text-3)" : isMissing ? "var(--amber)" : "var(--accent)" }}
						>
							{v.name}
						</code>
						<span className="text-xs flex-1" style={{ color: "var(--text-3)" }}>{v.desc}</span>
						{!isRestricted && <CopyButton text={v.name} />}
					</div>
				))}
			</div>

			{/* Restricted banner */}
			{isRestricted && (
				<div
					className="px-4 py-2 text-xs"
					style={{ borderTop: "1px solid var(--border)", color: "var(--text-3)", background: "var(--bg-2)" }}
				>
					Reddit disabled self-serve API access for new developers in late 2024. These vars are listed for reference — support will return if Reddit reopens access.
				</div>
			)}
		</div>
	);
}

export default function Guide() {
	const [platforms, setPlatforms] = useState([]);
	const [loading, setLoading]     = useState(true);

	useEffect(() => {
		api.getPlatforms().then(res => {
			const arr = Array.isArray(res) ? res : (res?.platforms || []);
			setPlatforms(arr);
			setLoading(false);
		}).catch(() => setLoading(false));
	}, []);

	const statusFor = (key) => {
		const p = platforms.find(p => p.key === key);
		return { authStatus: p?.auth_status || "not_configured", enabled: !!p?.enabled };
	};

	const configuredCount = PLATFORM_SETUP.filter(s => {
		if (s.restricted) return false;
		const { authStatus } = statusFor(s.key);
		return authStatus === "configured" || authStatus === "ok";
	}).length;
	const totalConfigurable = PLATFORM_SETUP.filter(s => !s.restricted).length;

	return (
		<div className="min-h-full" style={{ background: "var(--bg)" }}>
			{/* Header */}
			<div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
				<div className="px-8 py-6">
					<div className="flex items-start justify-between">
						<div>
							<h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Setup Guide</h1>
							<p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
								{loading
									? "Loading…"
									: `${configuredCount} of ${totalConfigurable} platforms configured · add ENV vars then restart the service`
								}
							</p>
						</div>
					</div>
				</div>
			</div>

			<div className="px-8 py-6 max-w-3xl">

				{/* How it works */}
				<div
					className="rounded-xl px-4 py-3 mb-6 text-sm"
					style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
				>
					<p className="font-semibold mb-1" style={{ color: "var(--text)" }}>How credentials work</p>
					<p style={{ color: "var(--text-3)" }}>
						Add the required variables to your <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: "var(--bg-4)", color: "var(--text-2)" }}>.env</code> file,
						then <strong style={{ color: "var(--text-2)" }}>restart the service</strong>. PostPigeon detects credentials on startup and
						auto-enables the platform. Copy the variable names below — the platform card shows which ones are still missing.
					</p>
				</div>

				{/* Platform cards */}
				<div className="space-y-3">
					<p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-3)" }}>
						Platform credentials
					</p>

					{loading ? (
						<div className="flex items-center justify-center py-16">
							<Loader2 size={18} className="animate-spin" style={{ color: "var(--text-3)" }} />
						</div>
					) : (
						PLATFORM_SETUP.map(setup => {
							const { authStatus, enabled } = statusFor(setup.key);
							return (
								<PlatformCard
									key={setup.key}
									setup={setup}
									authStatus={authStatus}
									enabled={enabled}
								/>
							);
						})
					)}
				</div>

				{/* Footer note */}
				<div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
					<p className="text-xs" style={{ color: "var(--text-3)" }}>
						After updating credentials, restart the service for changes to take effect.
						Platform toggle and character limit settings are saved instantly and don't require a restart.
					</p>
				</div>
			</div>
		</div>
	);
}
