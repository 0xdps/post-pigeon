import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
	Plus, RefreshCw, AlertTriangle, CheckCircle2,
	Clock, ArrowRight, PenSquare,
} from "lucide-react";
import { api } from "../api.js";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const PLATFORM = {
	twitter:  { label: "X",         color: "#60a5fa" },
	threads:  { label: "Threads",   color: "#a78bfa" },
	linkedin: { label: "LinkedIn",  color: "#38bdf8" },
	reddit:   { label: "Reddit",    color: "#fb923c" },
	devto:    { label: "Dev.to",    color: "#a3e635" },
	bluesky:  { label: "Bluesky",   color: "#67e8f9" },
};

function fmtTime(ts) {
	if (!ts) return "—";
	return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtRel(ts) {
	if (!ts) return "";
	const m = Math.floor((Date.now() - ts) / 60000);
	if (m < 1) return "just now";
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

function useClock() {
	const [now, setNow] = useState(new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(id);
	}, []);
	return now;
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, accent }) {
	return (
		<div
			className="rounded-xl p-4 flex flex-col gap-1"
			style={{
				background: accent ? "var(--accent-dim)" : "var(--bg-2)",
				border: `1px solid ${accent ? "rgba(168,230,61,0.2)" : "var(--border)"}`,
			}}
		>
			<span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
				{label}
			</span>
			<span
				className="text-3xl font-bold font-mono tracking-tight"
				style={{ color: accent ? "var(--accent)" : "var(--text)" }}
			>
				{value}
			</span>
			{sub && <span className="text-xs" style={{ color: "var(--text-2)" }}>{sub}</span>}
		</div>
	);
}

function PlatformDot({ platformKey, size = 8 }) {
	const p = PLATFORM[platformKey];
	return (
		<span
			className="rounded-full shrink-0"
			style={{ width: size, height: size, background: p?.color || "var(--text-3)" }}
			title={p?.label || platformKey}
		/>
	);
}

function StatusDot({ status }) {
	const colors = {
		pending: "var(--blue)",
		posted: "var(--green)",
		failed: "var(--red)",
		cancelled: "var(--text-3)",
		processing: "var(--amber)",
	};
	return (
		<span
			className="rounded-full shrink-0"
			style={{
				width: 6,
				height: 6,
				background: colors[status] || "var(--text-3)",
				boxShadow: status === "pending" ? `0 0 6px ${colors.pending}` : "none",
			}}
		/>
	);
}

/* ── Main ────────────────────────────────────────────────────────────────── */

export default function Dashboard() {
	const now = useClock();
	const [jobs, setJobs]             = useState([]);
	const [stats, setStats]           = useState({});
	const [postTitles, setPostTitles] = useState({});
	const [todayInfo, setTodayInfo]   = useState({ count: 0, limit: 10 });
	const [platforms, setPlatforms]   = useState([]);
	const [retrying, setRetrying]     = useState({});
	const [loading, setLoading]       = useState(true);

	const load = useCallback(async () => {
		try {
			const [jobsRes, statsRes, postsRes, settingsRes, platformsRes] = await Promise.all([
				api.listPublishJobs({ limit: 200 }),
				api.getPostStats(),
				api.listPosts({ limit: 500 }),
				api.getSettings(),
				api.getPlatforms(),
			]);
			const allJobs = Array.isArray(jobsRes) ? jobsRes : (jobsRes?.jobs || []);
			setJobs(allJobs);
			setStats(statsRes?.stats || {});
			const allPosts = Array.isArray(postsRes) ? postsRes : (postsRes?.posts || []);
			const map = {};
			for (const p of allPosts) map[p.id] = p.title || p.id;
			setPostTitles(map);
			const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
			const postedToday = allJobs.filter(
				(j) => j.status === "posted" && new Date(j.posted_at).getTime() >= todayStart.getTime()
			).length;
			setTodayInfo({ count: postedToday, limit: settingsRes?.daily_limit || 10 });
			setPlatforms(Array.isArray(platformsRes) ? platformsRes : (platformsRes?.platforms || []));
		} catch (err) {
			console.error("Dashboard load failed:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
		const id = setInterval(load, 30_000);
		return () => clearInterval(id);
	}, [load]);

	const retryJob = async (jobId) => {
		setRetrying((r) => ({ ...r, [jobId]: true }));
		try { await api.publishJob(jobId); await load(); }
		finally { setRetrying((r) => ({ ...r, [jobId]: false })); }
	};

	// Derived
	const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
	const todayEnd   = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

	const todayJobs = jobs
		.filter((j) => j.scheduled_at >= todayStart.getTime() && j.scheduled_at < todayEnd.getTime())
		.sort((a, b) => a.scheduled_at - b.scheduled_at);

	const failedJobs = jobs.filter((j) => j.status === "failed");
	const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	const weekPosted = jobs.filter((j) => j.status === "posted" && (j.posted_at || 0) >= weekAgo).length;
	const pendingJobs = jobs.filter((j) => j.status === "pending");
	const recentlyPosted = [...jobs.filter((j) => j.status === "posted")]
		.sort((a, b) => (b.posted_at || 0) - (a.posted_at || 0))
		.slice(0, 6);

	const totalPosts = Object.values(stats).reduce((s, v) => s + (v || 0), 0);
	const enabledPlatforms = platforms.filter((p) => p.enabled);

	const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
	const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

	if (loading) {
		return (
			<div className="p-8 flex items-center gap-2 text-sm" style={{ color: "var(--text-2)" }}>
				<RefreshCw size={14} className="animate-spin" /> Loading…
			</div>
		);
	}

	return (
		<div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-up">

			{/* ── Header ── */}
			<div className="flex items-start justify-between gap-6">
				<div>
					<div className="flex items-baseline gap-3">
						<h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
							Overview
						</h1>
						<span className="font-mono text-sm" style={{ color: "var(--text-3)" }}>
							{dateStr}
						</span>
					</div>
					<p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
						Your publishing command center.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button onClick={load} className="btn-icon" title="Refresh">
						<RefreshCw size={14} />
					</button>
					<Link to="/compose" className="btn-primary">
						<PenSquare size={13} /> Write a post
					</Link>
				</div>
			</div>

			{/* ── Live clock strip ── */}
			<div
				className="flex items-center gap-4 px-4 py-3 rounded-xl"
				style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
			>
				<span className="font-mono text-2xl font-semibold" style={{ color: "var(--accent)" }}>
					{timeStr}
				</span>
				<div className="h-6 w-px" style={{ background: "var(--border-2)" }} />
				<div className="flex items-center gap-4 text-xs font-mono" style={{ color: "var(--text-2)" }}>
					<span>
						<span style={{ color: "var(--text-3)" }}>today </span>
						{todayInfo.count} / {todayInfo.limit}
					</span>
					<span>
						<span style={{ color: "var(--text-3)" }}>pending </span>
						{pendingJobs.length}
					</span>
					<span>
						<span style={{ color: "var(--text-3)" }}>week </span>
						{weekPosted} published
					</span>
				</div>
				<div className="ml-auto flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
					<span
						className="w-2 h-2 rounded-full animate-pulse-dot"
						style={{ background: "var(--green)" }}
					/>
					Live
				</div>
			</div>

			{/* ── Stat cards ── */}
			<div className="grid grid-cols-4 gap-3">
				<StatCard label="Library" value={totalPosts} sub={`${stats.draft || 0} drafts`} />
				<StatCard label="Pending" value={pendingJobs.length} sub="in queue" />
				<StatCard label="This week" value={weekPosted} sub="published" />
				<StatCard label="Today" value={`${todayInfo.count}/${todayInfo.limit}`} sub="posts sent" accent />
			</div>

			{/* ── Failed jobs alert ── */}
			{failedJobs.length > 0 && (
				<div
					className="rounded-xl p-4"
					style={{ background: "var(--red-dim)", border: "1px solid rgba(248,113,113,0.2)" }}
				>
					<div className="flex items-center gap-2 mb-3">
						<AlertTriangle size={14} style={{ color: "var(--red)" }} />
						<span className="text-sm font-semibold" style={{ color: "var(--red)" }}>
							{failedJobs.length} failed job{failedJobs.length > 1 ? "s" : ""}
						</span>
					</div>
					<div className="space-y-2">
						{failedJobs.slice(0, 3).map((job) => (
							<div key={job.id} className="flex items-center gap-3">
								<PlatformDot platformKey={job.platform_key} />
								<span className="text-xs flex-1 truncate" style={{ color: "var(--text-2)" }}>
									{postTitles[job.post_id] || job.post_id}
								</span>
								<Link
									to={`/compose/${job.post_id}`}
									className="text-xs underline underline-offset-2"
									style={{ color: "var(--text-3)" }}
								>
									Edit
								</Link>
								<button
									onClick={() => retryJob(job.id)}
									disabled={retrying[job.id]}
									className="text-xs px-2 py-0.5 rounded font-medium transition-colors"
									style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(248,113,113,0.25)" }}
								>
									{retrying[job.id] ? "…" : "Retry"}
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* ── Main grid: Today's schedule + Recent activity ── */}
			<div className="grid grid-cols-5 gap-5">

				{/* Today's schedule — 3 cols */}
				<div className="col-span-3">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
							Today's dispatches
						</h2>
						<Link to="/activity" className="text-xs flex items-center gap-1" style={{ color: "var(--text-3)" }}>
							View all <ArrowRight size={10} />
						</Link>
					</div>

					{todayJobs.length === 0 ? (
						<div
							className="rounded-xl p-8 text-center"
							style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
						>
							<Clock size={22} className="mx-auto mb-2 opacity-25" style={{ color: "var(--text-2)" }} />
							<p className="text-sm" style={{ color: "var(--text-3)" }}>Nothing scheduled today</p>
							<Link
								to="/posts/new"
								className="inline-flex items-center gap-1.5 text-xs mt-3"
								style={{ color: "var(--accent)" }}
							>
								<Plus size={11} /> Compose a post
							</Link>
						</div>
					) : (
						<div
							className="rounded-xl overflow-hidden"
							style={{ border: "1px solid var(--border)", background: "var(--bg-2)" }}
						>
							{todayJobs.map((job, i) => {
								const p = PLATFORM[job.platform_key];
								return (
									<div
										key={job.id}
										className="flex items-center gap-3 px-4 py-3"
										style={{
											borderTop: i > 0 ? "1px solid var(--border)" : "none",
										}}
									>
										{/* Time */}
										<span className="font-mono text-xs w-12 shrink-0" style={{ color: "var(--text-3)" }}>
											{fmtTime(job.scheduled_at)}
										</span>

										{/* Platform dot */}
										<PlatformDot platformKey={job.platform_key} />

										{/* Title */}
						<Link
								to={`/compose/${job.post_id}`}
								className="flex-1 text-sm truncate hover:underline"
								style={{ color: "var(--text)" }}
								title={postTitles[job.post_id]}
							>
								{postTitles[job.post_id] || job.post_id}
							</Link>

										{/* Platform label */}
										<span className="text-[10px] font-mono shrink-0" style={{ color: p?.color || "var(--text-3)" }}>
											{p?.label || job.platform_key}
										</span>

										{/* Status */}
										<StatusDot status={job.status} />
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Right column — 2 cols */}
				<div className="col-span-2 space-y-5">

					{/* Platform health */}
					<div>
						<h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
							Platforms
						</h2>
						<div
							className="rounded-xl overflow-hidden"
							style={{ border: "1px solid var(--border)", background: "var(--bg-2)" }}
						>
							{platforms.slice(0, 6).map((plat, i) => {
								const p = PLATFORM[plat.key];
								const ok = plat.enabled && plat.auth_status === "ok";
								const warn = plat.enabled && plat.auth_status !== "ok";
								return (
									<div
										key={plat.key}
										className="flex items-center gap-3 px-4 py-2.5"
										style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
									>
										<span
											className="w-2 h-2 rounded-full shrink-0"
											style={{
												background: ok ? "var(--green)" : warn ? "var(--amber)" : "var(--border-3)",
											}}
										/>
										<span className="text-xs flex-1" style={{ color: "var(--text)" }}>
											{p?.label || plat.name}
										</span>
										<span
											className="text-[10px] font-mono"
											style={{ color: plat.enabled ? (ok ? "var(--green)" : "var(--amber)") : "var(--text-3)" }}
										>
											{plat.enabled ? (ok ? "ok" : plat.auth_status) : "off"}
										</span>
									</div>
								);
							})}
							{platforms.length === 0 && (
								<div className="px-4 py-4 text-xs" style={{ color: "var(--text-3)" }}>
									No platforms configured
								</div>
							)}
						</div>
					</div>

					{/* Recently published */}
					<div>
						<h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
							Recently published
						</h2>
						{recentlyPosted.length === 0 ? (
							<p className="text-xs" style={{ color: "var(--text-3)" }}>Nothing published yet.</p>
						) : (
							<div className="space-y-1.5">
								{recentlyPosted.map((job) => {
									const p = PLATFORM[job.platform_key];
									return (
										<div
											key={job.id}
											className="flex items-center gap-2 px-3 py-2 rounded-lg"
											style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
										>
											<CheckCircle2 size={11} style={{ color: "var(--green)" }} />
											<span className="text-xs flex-1 truncate" style={{ color: "var(--text-2)" }}>
												{postTitles[job.post_id] || job.post_id}
											</span>
											<span className="text-[10px] shrink-0 font-mono" style={{ color: p?.color || "var(--text-3)" }}>
												{p?.label || job.platform_key}
											</span>
											<span className="text-[10px] shrink-0" style={{ color: "var(--text-3)" }}>
												{fmtRel(job.posted_at)}
											</span>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>

	</div>
	);
}
