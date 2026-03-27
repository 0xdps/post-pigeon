import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
	Clock, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
	ExternalLink, Trash2, RotateCcw, PenLine, CalendarDays, List, LayoutList,
} from "lucide-react";
import { api } from "../api.js";

const PLATFORMS = {
	twitter:  { label: "X",       initial: "𝕏",  color: "#000",    bg: "#e7e7e7"  },
	bluesky:  { label: "Bluesky", initial: "Bk", color: "#0085ff", bg: "#daeeff"  },
	linkedin: { label: "LinkedIn",initial: "in", color: "#0077b5", bg: "#dbeafe"  },
	devto:    { label: "Dev.to",  initial: "D",  color: "#3b49df", bg: "#eceffe"  },
	reddit:   { label: "Reddit",  initial: "Rd", color: "#ff4500", bg: "#fff0eb"  },
	threads:  { label: "Threads", initial: "Th", color: "#8b5cf6", bg: "#f3e8ff"  },
};

const JOB_STATUS = {
	pending:    { label: "Pending",    color: "var(--text-3)", bg: "var(--bg-3)",           icon: Clock         },
	processing: { label: "Sending…",   color: "var(--amber)",  bg: "rgba(245,158,11,0.08)", icon: Loader2       },
	posted:     { label: "Published",  color: "var(--green)",  bg: "rgba(52,211,153,0.08)", icon: CheckCircle2  },
	failed:     { label: "Failed",     color: "var(--red)",    bg: "var(--red-dim)",        icon: XCircle       },
	cancelled:  { label: "Cancelled",  color: "var(--text-3)", bg: "var(--bg-3)",           icon: XCircle       },
};

const FILTER_TABS = [
	{ id: "all",      label: "All"      },
	{ id: "upcoming", label: "Upcoming" },
	{ id: "posted",   label: "Published"},
	{ id: "failed",   label: "Failed"   },
];

function PlatformPill({ platformKey }) {
	const p = PLATFORMS[platformKey];
	if (!p) return (
		<span className="inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-bold" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>
			{platformKey?.slice(0, 2)}
		</span>
	);
	return (
		<span
			className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold"
			style={{ background: p.bg, color: p.color }}
		>
			{p.initial} <span className="font-normal opacity-75">{p.label}</span>
		</span>
	);
}

function StatusChip({ status }) {
	const cfg = JOB_STATUS[status] || JOB_STATUS.pending;
	const Icon = cfg.icon;
	return (
		<span
			className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
			style={{ background: cfg.bg, color: cfg.color }}
		>
			<Icon size={10} className={status === "processing" ? "animate-spin" : ""} />
			{cfg.label}
		</span>
	);
}

function DeliveryRow({ job, onCancel, onRetry }) {
	const [cancelling, setCancelling] = useState(false);
	const [retrying, setRetrying] = useState(false);

	const handleCancel = async () => {
		if (!window.confirm("Cancel this scheduled delivery?")) return;
		setCancelling(true);
		await api.deleteSchedule(job.id);
		onCancel(job.id);
	};

	const handleRetry = async () => {
		setRetrying(true);
		await api.publishJob(job.id);
		onRetry(job.id);
	};

	const formatTime = (ts) => {
		if (!ts) return null;
		const d = new Date(ts);
		return d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
	};

	const time = formatTime(job.posted_at || job.scheduled_at);
	const isPending = job.status === "pending" || job.status === "processing";
	const isPosted = job.status === "posted";
	const isFailed = job.status === "failed";

	return (
		<div
			className="flex items-center gap-3 px-4 py-2.5 transition-colors"
			style={{ borderLeft: `2px solid ${isFailed ? "var(--red)" : isPosted ? "rgba(52,211,153,0.3)" : "var(--border)"}` }}
			onMouseEnter={e => e.currentTarget.style.background = "var(--bg-3)"}
			onMouseLeave={e => e.currentTarget.style.background = "transparent"}
		>
			{/* Platform */}
			<div className="w-28 shrink-0">
				<PlatformPill platformKey={job.platform_key} />
			</div>

			{/* Status */}
			<div className="w-24 shrink-0">
				<StatusChip status={job.status} />
			</div>

			{/* Time */}
			<div className="w-16 shrink-0">
				<span className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{time}</span>
			</div>

			{/* Mode badge */}
			{job.mode && job.mode !== "fixed" && (
				<span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>
					{job.mode}
				</span>
			)}

			{/* Error */}
			{isFailed && job.error && (
				<span className="text-xs flex-1 truncate" style={{ color: "var(--red)" }} title={job.error}>
					{job.error}
				</span>
			)}

			{/* Spacer */}
			<div className="flex-1" />

			{/* Actions */}
			<div className="flex items-center gap-1">
				{isPending && (
					<button
						onClick={handleCancel}
						disabled={cancelling}
						className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={e => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-dim)"; }}
						onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
					>
						{cancelling ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
						Cancel
					</button>
				)}
				{isFailed && (
					<button
						onClick={handleRetry}
						disabled={retrying}
						className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={e => { e.currentTarget.style.color = "var(--amber)"; e.currentTarget.style.background = "rgba(245,158,11,0.08)"; }}
						onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
					>
						{retrying ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
						Retry
					</button>
				)}
				{isPosted && job.platform_post_id && (
					<a
						href={`#`}
						className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim2)"; }}
						onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
					>
						<ExternalLink size={10} />
						View
					</a>
				)}
			</div>
		</div>
	);
}

// ── Content group card ─────────────────────────────────────────────────────────
function ContentGroup({ post, jobs, onCancelJob, onRetryJob }) {
	const pendingJobs  = jobs.filter(j => j.status === "pending" || j.status === "processing");
	const postedJobs   = jobs.filter(j => j.status === "posted");
	const failedJobs   = jobs.filter(j => j.status === "failed");

	const overallStatus = failedJobs.length > 0 ? "failed"
		: pendingJobs.length > 0 ? "pending"
		: postedJobs.length === jobs.length ? "posted"
		: "partial";

	const statusBar = {
		posted:  { color: "var(--green)",  label: `All ${jobs.length} published` },
		pending: { color: "var(--amber)",  label: `${pendingJobs.length} pending · ${postedJobs.length} published` },
		failed:  { color: "var(--red)",    label: `${failedJobs.length} failed · ${postedJobs.length} published` },
		partial: { color: "var(--text-3)", label: `${postedJobs.length} of ${jobs.length} published` },
	}[overallStatus];

	return (
		<div
			className="rounded-xl overflow-hidden"
			style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
		>
			{/* Post header */}
			<div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
						{post?.title || "Untitled post"}
					</p>
					<p className="text-xs mt-0.5 font-mono" style={{ color: statusBar.color }}>
						{statusBar.label}
					</p>
				</div>
				<div className="flex items-center gap-2 ml-3 shrink-0">
					<Link
						to={`/compose/${post?.id}`}
						className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "var(--bg-3)"; }}
						onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
					>
						<PenLine size={10} />
						Edit
					</Link>
				</div>
			</div>

			{/* Delivery rows */}
			<div className="divide-y" style={{ borderColor: "var(--border)" }}>
				{jobs.map(job => (
					<DeliveryRow
						key={job.id}
						job={job}
						onCancel={onCancelJob}
						onRetry={onRetryJob}
					/>
				))}
			</div>
		</div>
	);
}

// ── Date section ──────────────────────────────────────────────────────────────
function DateSection({ label, groups, posts, onCancelJob, onRetryJob }) {
	if (!groups.length) return null;
	return (
		<div className="mb-8">
			<div className="flex items-center gap-3 mb-3">
				<CalendarDays size={13} style={{ color: "var(--text-3)" }} />
				<h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-3)" }}>{label}</h3>
				<div className="flex-1 h-px" style={{ background: "var(--border)" }} />
			</div>
			<div className="space-y-3">
				{groups.map(({ postId, jobs }) => {
					const post = posts.find(p => p.id === postId);
					return (
						<ContentGroup
							key={postId}
							post={post}
							jobs={jobs}
							onCancelJob={onCancelJob}
							onRetryJob={onRetryJob}
						/>
					);
				})}
			</div>
		</div>
	);
}

// ── Flat list row (for list view) ─────────────────────────────────────────────
function FlatJobRow({ job, post, onCancel, onRetry }) {
	const [cancelling, setCancelling] = useState(false);
	const [retrying, setRetrying] = useState(false);
	const isPending = job.status === "pending" || job.status === "processing";
	const isPosted = job.status === "posted";
	const isFailed = job.status === "failed";

	const formatDateTime = (ts) => {
		if (!ts) return "—";
		const d = new Date(ts);
		return d.toLocaleDateString("en", { month: "short", day: "numeric" }) + " · " +
			d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
	};

	const handleCancel = async () => {
		if (!window.confirm("Cancel this delivery?")) return;
		setCancelling(true);
		await api.deleteSchedule(job.id);
		onCancel(job.id);
	};

	const handleRetry = async () => {
		setRetrying(true);
		await api.publishJob(job.id);
		onRetry(job.id);
	};

	return (
		<div
			className="flex items-center gap-4 px-4 py-3 transition-colors"
			style={{ borderBottom: "1px solid var(--border)" }}
			onMouseEnter={e => e.currentTarget.style.background = "var(--bg-2)"}
			onMouseLeave={e => e.currentTarget.style.background = "transparent"}
		>
			{/* Platform */}
			<div className="w-28 shrink-0">
				<PlatformPill platformKey={job.platform_key} />
			</div>
			{/* Post title */}
			<div className="flex-1 min-w-0">
				<p className="text-sm truncate" style={{ color: "var(--text-2)" }}>
					{post?.title || job.post_id}
				</p>
			</div>
			{/* Status */}
			<div className="w-24 shrink-0">
				<StatusChip status={job.status} />
			</div>
			{/* Time */}
			<div className="w-36 shrink-0 text-xs font-mono" style={{ color: "var(--text-3)" }}>
				{formatDateTime(job.posted_at || job.scheduled_at)}
			</div>
			{/* Actions */}
			<div className="flex items-center gap-1 shrink-0">
				{isPending && (
					<button onClick={handleCancel} disabled={cancelling}
						className="text-xs px-2 py-1 rounded transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={e => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-dim)"; }}
						onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}>
						{cancelling ? <Loader2 size={10} className="animate-spin" /> : "Cancel"}
					</button>
				)}
				{isFailed && (
					<button onClick={handleRetry} disabled={retrying}
						className="text-xs px-2 py-1 rounded transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={e => { e.currentTarget.style.color = "var(--amber)"; e.currentTarget.style.background = "rgba(245,158,11,0.08)"; }}
						onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}>
						{retrying ? <Loader2 size={10} className="animate-spin" /> : "Retry"}
					</button>
				)}
				{isFailed && job.error && (
					<span className="text-xs max-w-32 truncate" style={{ color: "var(--red)" }} title={job.error}>
						{job.error}
					</span>
				)}
			</div>
		</div>
	);
}

// ── Main Activity page ────────────────────────────────────────────────────────
export default function Activity() {
	const [posts, setPosts] = useState([]);
	const [jobs, setJobs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeFilter, setActiveFilter] = useState("all");
	const [viewMode, setViewMode] = useState("grouped"); // "grouped" | "list"

	const load = useCallback(async () => {
		setLoading(true);
		const [jobsRes, postsRes] = await Promise.all([
			api.listPublishJobs({ limit: 500 }),
			api.listPosts({ limit: 200 }),
		]);
		const allJobs = Array.isArray(jobsRes) ? jobsRes : (jobsRes?.jobs || []);
		const allPosts = Array.isArray(postsRes) ? postsRes : (postsRes?.posts || []);
		setJobs(allJobs);
		setPosts(allPosts);
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	const handleCancelJob = (jobId) => {
		setJobs(prev => prev.filter(j => j.id !== jobId));
	};

	const handleRetryJob = (jobId) => {
		setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "processing" } : j));
		setTimeout(load, 2000);
	};

	// Filter jobs
	const filteredJobs = jobs.filter(j => {
		if (activeFilter === "all") return true;
		if (activeFilter === "upcoming") return j.status === "pending" || j.status === "processing";
		if (activeFilter === "posted") return j.status === "posted";
		if (activeFilter === "failed") return j.status === "failed";
		return true;
	});

	// Group jobs by post_id, then by date bucket
	const grouped = {};
	filteredJobs.forEach(job => {
		const pid = job.post_id;
		if (!grouped[pid]) grouped[pid] = [];
		grouped[pid].push(job);
	});

	// Get the most relevant timestamp per group (earliest scheduled or latest posted)
	const getGroupTime = (jobList) => {
		const times = jobList.map(j => new Date(j.posted_at || j.scheduled_at || 0).getTime());
		return Math.min(...times.filter(t => t > 0));
	};

	const allGroups = Object.entries(grouped)
		.map(([postId, jobList]) => ({ postId, jobs: jobList, time: getGroupTime(jobList) }))
		.sort((a, b) => a.time - b.time);

	// Bucket into date sections
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
	const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
	const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

	const buckets = {
		overdue:   [],
		today:     [],
		tomorrow:  [],
		upcoming:  [],
		yesterday: [],
		older:     [],
	};

	allGroups.forEach(g => {
		const t = new Date(g.time);
		const tDay = new Date(t.getFullYear(), t.getMonth(), t.getDate());
		const hasUpcoming = g.jobs.some(j => j.status === "pending" || j.status === "processing");
		const allPast = g.jobs.every(j => j.status === "posted" || j.status === "failed" || j.status === "cancelled");

		if (hasUpcoming) {
			if (tDay < today) buckets.overdue.push(g);
			else if (+tDay === +today) buckets.today.push(g);
			else if (+tDay === +tomorrow) buckets.tomorrow.push(g);
			else buckets.upcoming.push(g);
		} else {
			if (+tDay === +today) buckets.today.push(g);
			else if (+tDay === +yesterday) buckets.yesterday.push(g);
			else buckets.older.push(g);
		}
	});

	const totalPending = jobs.filter(j => j.status === "pending" || j.status === "processing").length;
	const totalPosted  = jobs.filter(j => j.status === "posted").length;
	const totalFailed  = jobs.filter(j => j.status === "failed").length;

	return (
		<div className="min-h-full" style={{ background: "var(--bg)" }}>
			{/* ── Header ── */}
			<div
				className="sticky top-0 z-10"
				style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)" }}
			>
				<div className="px-8 pt-6 pb-0">
					<div className="flex items-end justify-between mb-4">
						<div>
							<h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Activity</h1>
							<p className="text-sm mt-0.5 font-mono" style={{ color: "var(--text-3)" }}>
								{totalPending > 0 && <span style={{ color: "var(--amber)" }}>{totalPending} pending · </span>}
								<span style={{ color: "var(--green)" }}>{totalPosted} published</span>
								{totalFailed > 0 && <span style={{ color: "var(--red)" }}> · {totalFailed} failed</span>}
							</p>
						</div>
						<div className="flex items-center gap-2">
							{/* View toggle — grouped / list */}
							<div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-2)" }}>
								{[
									{ id: "grouped", icon: LayoutList, title: "Grouped by post" },
									{ id: "list",    icon: List,       title: "Flat list" },
								].map(({ id, icon: Icon, title }) => (
									<button
										key={id}
										onClick={() => setViewMode(id)}
										title={title}
										style={{
											width: 36, height: 36,
											display: "flex", alignItems: "center", justifyContent: "center",
											background: viewMode === id ? "var(--accent)" : "var(--bg-3)",
											color: viewMode === id ? "#080808" : "var(--text-3)",
											transition: "all 0.15s",
										}}
									>
										<Icon size={14} />
									</button>
								))}
							</div>
							<button onClick={load} className="btn-icon" title="Refresh">
								<RefreshCw size={14} />
							</button>
						</div>
					</div>

					{/* Filter tabs */}
					<div className="flex items-center gap-0">
						{FILTER_TABS.map(({ id, label }) => {
							const count = {
								all:      jobs.length,
								upcoming: jobs.filter(j => j.status === "pending" || j.status === "processing").length,
								posted:   jobs.filter(j => j.status === "posted").length,
								failed:   jobs.filter(j => j.status === "failed").length,
							}[id];
							return (
								<button
									key={id}
									onClick={() => setActiveFilter(id)}
									className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
									style={{
										color: activeFilter === id ? "var(--accent)" : "var(--text-3)",
										borderColor: activeFilter === id ? "var(--accent)" : "transparent",
										background: "transparent",
									}}
								>
									{label}
									<span
										className="text-xs px-1.5 py-0.5 rounded-full font-mono"
										style={{
											background: activeFilter === id ? "var(--accent-dim2)" : "var(--bg-3)",
											color: activeFilter === id ? "var(--accent)" : "var(--text-3)",
										}}
									>
										{count}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* ── Content ── */}
			<div className="px-8 py-6">
				{loading ? (
					<div className="flex items-center justify-center py-24">
						<Loader2 size={20} className="animate-spin" style={{ color: "var(--text-3)" }} />
					</div>
				) : viewMode === "list" ? (
					/* ── Flat list view ── */
					filteredJobs.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-24 text-center">
							<CheckCircle2 size={32} style={{ color: "var(--text-3)" }} className="mb-3" />
							<p className="text-sm" style={{ color: "var(--text-3)" }}>No activity matching this filter.</p>
						</div>
					) : (
						<div
							className="rounded-xl overflow-hidden"
							style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
						>
							{/* Table header */}
							<div
								className="flex items-center gap-4 px-4 py-2"
								style={{ background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}
							>
								<div className="w-28 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-3)" }}>Platform</div>
								<div className="flex-1 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-3)" }}>Post</div>
								<div className="w-24 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-3)" }}>Status</div>
								<div className="w-36 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-3)" }}>When</div>
								<div className="w-24 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-3)" }}>Actions</div>
							</div>
							{filteredJobs
								.sort((a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0))
								.map(job => (
									<FlatJobRow
										key={job.id}
										job={job}
										post={posts.find(p => p.id === job.post_id)}
										onCancel={handleCancelJob}
										onRetry={handleRetryJob}
									/>
								))
							}
						</div>
					)
				) : allGroups.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-24 text-center">
						<CheckCircle2 size={32} style={{ color: "var(--text-3)" }} className="mb-3" />
						<p className="font-medium mb-1" style={{ color: "var(--text-2)" }}>No activity yet</p>
						<p className="text-sm mb-4" style={{ color: "var(--text-3)" }}>
							Publish a post to see delivery activity here.
						</p>
						<Link to="/compose" className="btn-primary flex items-center gap-2 text-sm">
							<PenLine size={13} /> Write a post
						</Link>
					</div>
				) : (
					<div className="max-w-3xl">
						{/* Overdue */}
						{buckets.overdue.length > 0 && (
							<div className="mb-6 p-4 rounded-xl" style={{ background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.2)" }}>
								<div className="flex items-center gap-2 mb-3">
									<AlertTriangle size={13} style={{ color: "var(--red)" }} />
									<h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--red)" }}>Overdue</h3>
								</div>
								<div className="space-y-3">
									{buckets.overdue.map(({ postId, jobs: groupJobs }) => (
										<ContentGroup key={postId} post={posts.find(p => p.id === postId)} jobs={groupJobs} onCancelJob={handleCancelJob} onRetryJob={handleRetryJob} />
									))}
								</div>
							</div>
						)}

						{/* UPCOMING section */}
						{(buckets.today.some(g => g.jobs.some(j => j.status === "pending")) ||
						  buckets.tomorrow.length > 0 || buckets.upcoming.length > 0) && (
							<div className="mb-2">
								<h2 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "var(--text-3)" }}>Upcoming</h2>
							</div>
						)}

						<DateSection label="Today" groups={buckets.today} posts={posts} onCancelJob={handleCancelJob} onRetryJob={handleRetryJob} />
						<DateSection label="Tomorrow" groups={buckets.tomorrow} posts={posts} onCancelJob={handleCancelJob} onRetryJob={handleRetryJob} />
						<DateSection label="Later" groups={buckets.upcoming} posts={posts} onCancelJob={handleCancelJob} onRetryJob={handleRetryJob} />

						{/* HISTORY section */}
						{(buckets.yesterday.length > 0 || buckets.older.length > 0) && (
							<div className="mb-2 mt-8">
								<h2 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "var(--text-3)" }}>History</h2>
							</div>
						)}

						<DateSection label="Yesterday" groups={buckets.yesterday} posts={posts} onCancelJob={handleCancelJob} onRetryJob={handleRetryJob} />
						<DateSection label="Older" groups={buckets.older} posts={posts} onCancelJob={handleCancelJob} onRetryJob={handleRetryJob} />
					</div>
				)}
			</div>
		</div>
	);
}
