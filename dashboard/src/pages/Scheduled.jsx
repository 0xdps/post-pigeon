import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Clock, CheckCircle2, AlertCircle, XCircle, RefreshCw, Plus, ExternalLink, RotateCcw, Loader } from "lucide-react";
import { api } from "../api.js";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const PLATFORM = {
	twitter:  { label: "X",        color: "#60a5fa" },
	threads:  { label: "Threads",  color: "#a78bfa" },
	linkedin: { label: "LinkedIn", color: "#38bdf8" },
	reddit:   { label: "Reddit",   color: "#fb923c" },
	devto:    { label: "Dev.to",   color: "#a3e635" },
	bluesky:  { label: "Bluesky",  color: "#67e8f9" },
};

const STATUS_META = {
	pending:    { label: "Pending",    badge: "badge-pending",   icon: Clock        },
	processing: { label: "Processing", badge: "badge-pending",   icon: Loader       },
	posted:     { label: "Posted",     badge: "badge-posted",    icon: CheckCircle2 },
	failed:     { label: "Failed",     badge: "badge-failed",    icon: AlertCircle  },
	cancelled:  { label: "Cancelled",  badge: "badge-cancelled", icon: XCircle      },
};

const FILTERS = ["all", "pending", "posted", "failed", "cancelled"];

function fmt(ts) {
	if (!ts) return "—";
	return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtTime(ts) {
	if (!ts) return "—";
	return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(ts) {
	if (!ts) return "Unscheduled";
	const d = new Date(ts);
	const today     = new Date();
	const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
	const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
	if (d.toDateString() === today.toDateString())     return "Today";
	if (d.toDateString() === tomorrow.toDateString())  return "Tomorrow";
	if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
	return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function groupByDate(jobs) {
	const groups = new Map();
	for (const job of jobs) {
		const ts    = job.posted_at || job.scheduled_at;
		const label = dateLabel(ts);
		if (!groups.has(label)) groups.set(label, []);
		groups.get(label).push(job);
	}
	return groups;
}

/* ── Job row ─────────────────────────────────────────────────────────────── */

function JobRow({ job, title, onRetry, onCancel, retrying, cancelling }) {
	const plat       = PLATFORM[job.platform_key];
	const sm         = STATUS_META[job.status] || STATUS_META.pending;
	const StatusIcon = sm.icon;
	const ts         = job.status === "posted" ? job.posted_at : job.scheduled_at;
	const tweetUrl   = job.platform_post_id ? `https://x.com/i/status/${job.platform_post_id}` : null;

	return (
		<div
			className="flex items-center gap-3 px-4 py-3 transition-all"
			style={{ borderTop: "1px solid var(--border)" }}
		>
			{/* Time */}
			<span className="font-mono text-xs w-12 shrink-0 text-right" style={{ color: "var(--text-3)" }}>
				{fmtTime(ts)}
			</span>

			{/* Platform dot + label */}
			<div className="flex items-center gap-1.5 w-20 shrink-0">
				<span
					className="w-2 h-2 rounded-full shrink-0"
					style={{ background: plat?.color || "var(--text-3)" }}
				/>
				<span className="text-xs font-mono truncate" style={{ color: plat?.color || "var(--text-3)" }}>
					{plat?.label || job.platform_key}
				</span>
			</div>

			{/* Post title */}
			<Link
				to={`/posts/${job.post_id}`}
				className="flex-1 text-sm truncate hover:underline underline-offset-2"
				style={{ color: "var(--text)" }}
				title={title}
			>
				{title}
			</Link>

			{/* Status badge */}
			<span className={`badge ${sm.badge} shrink-0 gap-1`}>
				<StatusIcon size={10} />
				{sm.label}
			</span>

			{/* Actions */}
			<div className="flex items-center gap-1 shrink-0">
				{job.status === "posted" && tweetUrl && (
					<a
						href={tweetUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1 transition-all"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
					>
						<ExternalLink size={10} /> View
					</a>
				)}
				{job.status === "failed" && (
					<button
						type="button"
						onClick={() => onRetry(job.id)}
						disabled={retrying === job.id}
						className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1 transition-all"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
					>
						<RotateCcw size={10} className={retrying === job.id ? "animate-spin" : ""} />
						{retrying === job.id ? "…" : "Retry"}
					</button>
				)}
				{job.status === "pending" && (
					<button
						type="button"
						onClick={() => onCancel(job.id)}
						disabled={cancelling === job.id}
						className="text-[11px] px-2 py-1 rounded-md transition-all"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-dim)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
					>
						{cancelling === job.id ? "…" : "Cancel"}
					</button>
				)}
			</div>
		</div>
	);
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

export default function Queue() {
	const [jobs, setJobs]             = useState([]);
	const [postTitles, setPostTitles] = useState({});
	const [filter, setFilter]         = useState("all");
	const [loading, setLoading]       = useState(true);
	const [cancelling, setCancelling] = useState(null);
	const [retrying, setRetrying]     = useState(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [jobsRes, postsRes] = await Promise.all([
				api.listPublishJobs({ limit: 300 }),
				api.listPosts({ limit: 500 }),
			]);
			setJobs(jobsRes?.jobs || []);
			const map = {};
			for (const p of postsRes?.posts || []) map[p.id] = p.title || p.id;
			setPostTitles(map);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { load(); }, [load]);

	const cancelJob = async (jobId) => {
		setCancelling(jobId);
		try { await api.deleteSchedule(jobId); await load(); }
		finally { setCancelling(null); }
	};

	const retryJob = async (jobId) => {
		setRetrying(jobId);
		try { await api.publishJob(jobId); await load(); }
		finally { setRetrying(null); }
	};

	const visible = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);
	const sorted  = [...visible].sort((a, b) => {
		const ta = a.posted_at || a.scheduled_at || 0;
		const tb = b.posted_at || b.scheduled_at || 0;
		return tb - ta;
	});

	const counts = FILTERS.reduce((acc, f) => {
		acc[f] = f === "all" ? jobs.length : jobs.filter((j) => j.status === f).length;
		return acc;
	}, {});

	const groups = groupByDate(sorted);

	return (
		<div className="p-8 max-w-4xl mx-auto animate-fade-up">

			{/* ── Header ── */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>Queue</h1>
					<p className="text-sm mt-0.5" style={{ color: "var(--text-2)" }}>
						All publish jobs — schedule, retry, or cancel.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button onClick={load} disabled={loading} className="btn-ghost">
						<RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
					</button>
					<Link to="/posts/new" className="btn-primary">
						<Plus size={13} /> New Post
					</Link>
				</div>
			</div>

			{/* ── Filter tabs ── */}
			<div className="flex items-center gap-0.5 mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
				{FILTERS.map((f) => (
					<button
						key={f}
						onClick={() => setFilter(f)}
						className="capitalize text-xs px-3 py-2 -mb-px transition-all font-medium"
						style={{
							color:       f === filter ? "var(--accent)"  : "var(--text-3)",
							borderBottom: f === filter ? "2px solid var(--accent)" : "2px solid transparent",
						}}
					>
						{f}
						{counts[f] > 0 && (
							<span className="ml-1.5 font-mono" style={{ color: f === filter ? "var(--accent)" : "var(--text-3)" }}>
								{counts[f]}
							</span>
						)}
					</button>
				))}
			</div>

			{/* ── Content ── */}
			{loading ? (
				<div className="py-12 flex items-center justify-center gap-2 text-sm" style={{ color: "var(--text-3)" }}>
					<Loader size={14} className="animate-spin" /> Loading…
				</div>
			) : sorted.length === 0 ? (
				<div
					className="py-16 text-center rounded-xl"
					style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
				>
					<Clock size={26} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-2)" }} />
					<p className="text-sm" style={{ color: "var(--text-3)" }}>
						No jobs{filter !== "all" ? ` with status "${filter}"` : ""}
					</p>
					<Link to="/posts/new" className="inline-flex items-center gap-1.5 text-xs mt-3" style={{ color: "var(--accent)" }}>
						<Plus size={11} /> Create a post
					</Link>
				</div>
			) : (
				<div className="space-y-6">
					{[...groups.entries()].map(([label, groupJobs]) => (
						<div key={label}>
							{/* Date header */}
							<div className="flex items-center gap-3 mb-2">
								<span
									className="text-[10px] uppercase tracking-widest font-semibold"
									style={{ color: label === "Today" ? "var(--accent)" : "var(--text-3)" }}
								>
									{label}
								</span>
								<span
									className="text-[10px] font-mono"
									style={{ color: "var(--text-3)" }}
								>
									{groupJobs.length} job{groupJobs.length !== 1 ? "s" : ""}
								</span>
								<div className="flex-1 h-px" style={{ background: "var(--border)" }} />
							</div>

							{/* Job rows */}
							<div
								className="rounded-xl overflow-hidden"
								style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
							>
								{groupJobs.map((job) => (
									<JobRow
										key={job.id}
										job={job}
										title={postTitles[job.post_id] || job.post_id}
										onRetry={retryJob}
										onCancel={cancelJob}
										retrying={retrying}
										cancelling={cancelling}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
