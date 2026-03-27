import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
	Plus, RefreshCw, AlertTriangle, CheckCircle2,
	Clock, ArrowRight, Zap, FileText,
} from "lucide-react";
import { api } from "../api.js";

// ── Statics ──────────────────────────────────────────────────────────────────

const P = {
	twitter:  { label: "X / Twitter", color: "text-blue-300",    bg: "bg-blue-400/10"    },
	threads:  { label: "Threads",      color: "text-violet-300", bg: "bg-violet-400/10"  },
	linkedin: { label: "LinkedIn",     color: "text-sky-300",    bg: "bg-sky-400/10"     },
	reddit:   { label: "Reddit",       color: "text-orange-300", bg: "bg-orange-400/10"  },
	devto:    { label: "Dev.to",       color: "text-zinc-300",   bg: "bg-zinc-700/40"    },
	bluesky:  { label: "Bluesky",      color: "text-cyan-300",   bg: "bg-cyan-400/10"    },
};

function fmtTime(ts) {
	if (!ts) return "—";
	return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(ts) {
	if (!ts) return "";
	const m = Math.floor((Date.now() - ts) / 60000);
	if (m < 1)  return "just now";
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

function greeting() {
	const h = new Date().getHours();
	if (h < 12) return "Good morning";
	if (h < 17) return "Good afternoon";
	return "Good evening";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
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
			const allJobs = jobsRes?.jobs || [];
			setJobs(allJobs);
			setStats(statsRes?.stats || {});
			const map = {};
			for (const p of postsRes?.posts || []) map[p.id] = p.title || p.id;
			setPostTitles(map);
			const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
			const postedToday = allJobs.filter(
				(j) => j.status === "posted" && j.posted_at >= todayStart.getTime()
			).length;
			setTodayInfo({ count: postedToday, limit: settingsRes?.daily_limit || 10 });
			setPlatforms(platformsRes?.platforms || []);
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
		try {
			await api.publishJob(jobId);
			await load();
		} finally {
			setRetrying((r) => ({ ...r, [jobId]: false }));
		}
	};

	// ── Derived ───────────────────────────────────────────────────────────────
	const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
	const todayEnd   = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

	const todayJobs = jobs
		.filter((j) => j.scheduled_at >= todayStart.getTime() && j.scheduled_at < todayEnd.getTime())
		.sort((a, b) => a.scheduled_at - b.scheduled_at);

	const failedJobs   = jobs.filter((j) => j.status === "failed");
	const weekAgo      = Date.now() - 7 * 24 * 60 * 60 * 1000;
	const weekPosted   = jobs.filter((j) => j.status === "posted" && (j.posted_at || 0) >= weekAgo).length;
	const pendingCount = jobs.filter((j) => j.status === "pending").length;

	const recentPosted = jobs
		.filter((j) => j.status === "posted")
		.sort((a, b) => (b.posted_at || 0) - (a.posted_at || 0))
		.slice(0, 7);

	// ── Loading skeleton ──────────────────────────────────────────────────────
	if (loading) {
		return (
			<div className="p-8 animate-pulse space-y-6 max-w-5xl">
				<div className="h-7 w-40 bg-zinc-800 rounded" />
				<div className="grid grid-cols-4 gap-3">
					{[0,1,2,3].map((i) => <div key={i} className="h-16 card rounded-xl" />)}
				</div>
				<div className="grid grid-cols-5 gap-6">
					<div className="col-span-3 h-64 card rounded-xl" />
					<div className="col-span-2 h-64 card rounded-xl" />
				</div>
			</div>
		);
	}

	return (
		<div className="p-8 max-w-5xl space-y-8">

			{/* ── Header ── */}
			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-xl font-semibold">{greeting()}</h1>
					<p className="text-zinc-500 text-sm mt-0.5">
						{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button onClick={load} className="btn-ghost border border-[#252525]" title="Refresh">
						<RefreshCw size={14} />
					</button>
					<Link to="/posts/new" className="btn-primary">
						<Plus size={14} /> New Post
					</Link>
				</div>
			</div>

			{/* ── Stats bar ── */}
			<div className="grid grid-cols-4 gap-3">
				<StatCard
					label="Library"
					value={stats.total || 0}
					sub={stats.draft > 0 ? `${stats.draft} draft${stats.draft !== 1 ? "s" : ""}` : "no drafts"}
					to="/posts"
					icon={<FileText size={13} className="text-zinc-700" />}
				/>
				<StatCard
					label="Queue"
					value={pendingCount}
					sub="pending"
					to="/queue"
					tone={pendingCount > 0 ? "text-sky-400" : "text-zinc-400"}
					highlight={pendingCount > 0}
				/>
				<StatCard
					label="This week"
					value={weekPosted}
					sub="published"
					tone="text-emerald-400"
				/>
				<StatCard
					label="Today"
					value={`${todayInfo.count} / ${todayInfo.limit}`}
					sub="of daily limit used"
					tone={todayInfo.count >= todayInfo.limit ? "text-red-400" : "text-zinc-300"}
				/>
			</div>

			{/* ── Failed alert ── */}
			{failedJobs.length > 0 && (
				<div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
					<div className="flex items-center gap-2 mb-3">
						<AlertTriangle size={14} className="text-red-400 shrink-0" />
						<p className="text-sm font-medium text-red-300">
							{failedJobs.length} job{failedJobs.length !== 1 ? "s" : ""} failed — action required
						</p>
					</div>
					<div className="space-y-1.5">
						{failedJobs.map((job) => (
							<div key={job.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#1a0f0f] border border-red-500/10">
								<span className={`text-xs font-medium shrink-0 ${P[job.platform_key]?.color || "text-zinc-400"}`}>
									{P[job.platform_key]?.label || job.platform_key}
								</span>
								<span className="flex-1 text-xs text-zinc-400 truncate">
									{postTitles[job.post_id] || job.post_id}
								</span>
								<Link
									to={`/posts/${job.post_id}`}
									className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
								>
									Edit
								</Link>
								<button
									onClick={() => retryJob(job.id)}
									disabled={retrying[job.id]}
									className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded
									           bg-red-500/15 text-red-400 border border-red-500/25
									           hover:bg-red-500/25 transition-colors shrink-0 disabled:opacity-50"
								>
									{retrying[job.id] ? "Retrying…" : <><Zap size={10} /> Retry</>}
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* ── Main columns ── */}
			<div className="grid grid-cols-5 gap-7">

				{/* Today's timeline — 3 cols */}
				<div className="col-span-3">
					<SectionHeader
						title="Today's schedule"
						icon={<Clock size={12} />}
						to="/queue"
						linkLabel="Full queue"
					/>

					{todayJobs.length === 0 ? (
						<div className="card rounded-xl px-5 py-10 flex flex-col items-center gap-4 text-center">
							<div className="w-10 h-10 rounded-full bg-[#1e1e1e] flex items-center justify-center">
								<Clock size={18} className="text-zinc-600" />
							</div>
							<div>
								<p className="text-sm text-zinc-400 font-medium mb-1">Nothing going out today</p>
								<p className="text-xs text-zinc-600">Schedule a post and it'll appear here</p>
							</div>
							<Link to="/posts/new" className="btn-primary mt-1">
								<Plus size={13} /> Schedule something
							</Link>
						</div>
					) : (
						<div className="relative pl-4">
							{/* Vertical spine */}
							<div className="absolute left-[7px] top-4 bottom-4 w-px bg-[#252525]" />

							<div className="space-y-1.5">
								{todayJobs.map((job) => {
									const isPosted  = job.status === "posted";
									const isFailed  = job.status === "failed";
									const isPending = job.status === "pending";

									return (
										<div key={job.id} className="flex items-center gap-3 relative">
											{/* Node */}
											<div className={`absolute -left-4 w-3 h-3 rounded-full border-2 shrink-0 z-10 ${
												isPosted ? "bg-emerald-500 border-emerald-500" :
												isFailed ? "bg-red-500 border-red-500" :
												"bg-[#161616] border-zinc-600"
											}`} />

											<div className={`flex-1 card rounded-lg px-3 py-2.5 flex items-center gap-3 ${
												isFailed ? "border-red-500/20 bg-red-500/[0.03]" : ""
											}`}>
												<span className="text-[11px] text-zinc-600 w-11 shrink-0 font-mono tabular-nums">
													{fmtTime(job.scheduled_at)}
												</span>
												<span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0
												                  ${P[job.platform_key]?.bg || ""} ${P[job.platform_key]?.color || "text-zinc-400"}`}>
													{P[job.platform_key]?.label || job.platform_key}
												</span>
												<Link
													to={`/posts/${job.post_id}`}
													className="flex-1 text-xs text-zinc-300 truncate hover:text-white transition-colors"
												>
													{postTitles[job.post_id] || "—"}
												</Link>
												{isPosted  && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
												{isFailed  && <span className="text-[10px] text-red-400 shrink-0">failed</span>}
												{isPending && <span className="text-[10px] text-zinc-600 shrink-0">pending</span>}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>

				{/* Right column — 2 cols */}
				<div className="col-span-2 space-y-7">

					{/* Platform health */}
					<div>
						<SectionHeader title="Platforms" to="/platforms" linkLabel="Manage" />
						{platforms.length === 0 ? (
							<div className="card rounded-xl px-4 py-5 text-center">
								<p className="text-xs text-zinc-600 mb-3">No platforms configured yet</p>
								<Link to="/platforms" className="text-xs text-sky-500 hover:text-sky-400 transition-colors">
									Set up platforms →
								</Link>
							</div>
						) : (
							<div className="card rounded-xl divide-y divide-[#1e1e1e] overflow-hidden">
								{platforms.map((p) => {
									const connected = p.enabled && p.auth_status === "connected";
									const needsAuth = p.enabled && p.auth_status !== "connected";
									return (
										<div key={p.key} className="flex items-center gap-2.5 px-3 py-2.5">
											<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
												connected ? "bg-emerald-500" :
												needsAuth ? "bg-amber-400" :
												"bg-zinc-700"
											}`} />
											<span className={`text-xs font-medium flex-1 ${P[p.key]?.color || "text-zinc-400"}`}>
												{P[p.key]?.label || p.key}
											</span>
											<span className={`text-[10px] ${
												connected ? "text-zinc-600" :
												needsAuth ? "text-amber-500" :
												"text-zinc-700"
											}`}>
												{!p.enabled ? "off" : connected ? "connected" : p.auth_status || "not set up"}
											</span>
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Recently published */}
					<div>
						<SectionHeader
							title="Recently published"
							icon={<CheckCircle2 size={12} />}
						/>
						{recentPosted.length === 0 ? (
							<p className="text-xs text-zinc-600 py-2">Nothing published yet</p>
						) : (
							<div className="space-y-0.5">
								{recentPosted.map((job) => (
									<div key={job.id} className="flex items-center gap-2 py-1.5">
										<span className={`text-[11px] font-medium shrink-0 w-14 truncate ${P[job.platform_key]?.color || "text-zinc-400"}`}>
											{job.platform_key}
										</span>
										<Link
											to={`/posts/${job.post_id}`}
											className="flex-1 text-xs text-zinc-500 hover:text-zinc-300 truncate transition-colors min-w-0"
										>
											{postTitles[job.post_id] || "—"}
										</Link>
										<span className="text-[10px] text-zinc-700 shrink-0 tabular-nums">
											{fmtRelative(job.posted_at)}
										</span>
									</div>
								))}
							</div>
						)}
					</div>

				</div>
			</div>
		</div>
	);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, to, tone = "text-zinc-200", highlight = false, icon }) {
	const inner = (
		<div className={`card rounded-xl p-4 transition-colors h-full
		                 ${to ? "hover:border-zinc-600" : ""}
		                 ${highlight ? "border-sky-500/20 bg-sky-500/[0.04]" : ""}`}>
			<div className="flex items-center justify-between mb-2">
				<p className="text-[11px] uppercase tracking-wider text-zinc-600">{label}</p>
				{icon}
			</div>
			<p className={`text-2xl font-semibold leading-none ${tone}`}>{value}</p>
			{sub && <p className="text-[11px] text-zinc-600 mt-1.5">{sub}</p>}
		</div>
	);

	return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

function SectionHeader({ title, icon, to, linkLabel = "See all" }) {
	return (
		<div className="flex items-center justify-between mb-3">
			<h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
				{icon}{title}
			</h2>
			{to && (
				<Link to={to} className="text-xs text-zinc-600 hover:text-sky-500 transition-colors flex items-center gap-1">
					{linkLabel} <ArrowRight size={11} />
				</Link>
			)}
		</div>
	);
}
