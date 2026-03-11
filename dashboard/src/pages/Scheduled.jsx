import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Clock, CheckCircle2, AlertCircle, XCircle, RefreshCw, Plus, ExternalLink, RotateCcw } from "lucide-react";
import { api } from "../api.js";

const STATUS_STYLE = {
	pending:   "bg-amber-500/10  text-amber-300  border-amber-500/20",
	posted:    "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
	failed:    "bg-red-500/10    text-red-300     border-red-500/20",
	cancelled: "bg-zinc-800      text-zinc-500    border-zinc-700",
};

const STATUS_ICON = {
	pending:   <Clock size={11} />,
	posted:    <CheckCircle2 size={11} />,
	failed:    <AlertCircle size={11} />,
	cancelled: <XCircle size={11} />,
};

const PLATFORM_COLOR = {
	twitter:  "text-sky-400",
	linkedin: "text-blue-400",
	reddit:   "text-orange-400",
	threads:  "text-purple-400",
	devto:    "text-violet-400",
	github:   "text-zinc-300",
};

function fmt(ts) {
	if (!ts) return "—";
	return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dateLabel(ts) {
	if (!ts) return "Unscheduled";
	const d = new Date(ts);
	const today = new Date();
	const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
	const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
	if (d.toDateString() === today.toDateString())     return "Today";
	if (d.toDateString() === tomorrow.toDateString())  return "Tomorrow";
	if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
	return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function groupByDate(jobs) {
	const groups = new Map();
	for (const job of jobs) {
		const ts = job.posted_at || job.scheduled_at;
		const label = dateLabel(ts);
		if (!groups.has(label)) groups.set(label, []);
		groups.get(label).push(job);
	}
	return groups;
}

const FILTERS = ["all", "pending", "posted", "failed", "cancelled"];

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
		try {
			await api.deleteSchedule(jobId);
			await load();
		} finally {
			setCancelling(null);
		}
	};

	const retryJob = async (jobId) => {
		setRetrying(jobId);
		try {
			await api.publishJob(jobId);
			await load();
		} finally {
			setRetrying(null);
		}
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
		<div className="p-8 max-w-4xl">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold">Queue</h1>
					<p className="text-zinc-500 text-sm mt-0.5">All publish jobs — schedule, retry, or cancel.</p>
				</div>
				<div className="flex items-center gap-2">
					<button onClick={load} disabled={loading} className="btn-ghost border border-[#252525]">
						<RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
					</button>
					<Link to="/posts/new" className="btn-primary">
						<Plus size={14} /> New Post
					</Link>
				</div>
			</div>

			{/* Filter tabs */}
			<div className="flex items-center gap-1 mb-5 border-b border-[#252525]">
				{FILTERS.map((f) => (
					<button
						key={f}
						onClick={() => setFilter(f)}
						className={`capitalize text-xs px-3 py-2 border-b-2 transition-colors -mb-px ${
							f === filter
								? "border-amber-400 text-amber-300"
								: "border-transparent text-zinc-500 hover:text-zinc-300"
						}`}
					>
						{f} {counts[f] > 0 && <span className="ml-0.5 text-zinc-600">({counts[f]})</span>}
					</button>
				))}
			</div>

			{loading ? (
				<div className="text-sm text-zinc-600">Loading…</div>
			) : sorted.length === 0 ? (
				<div className="text-center py-16 text-zinc-600">
					<Clock size={28} className="mx-auto mb-3 opacity-30" />
					<p className="text-sm">No jobs{filter !== "all" ? ` with status "${filter}"` : ""}</p>
					<Link to="/posts/new" className="mt-4 inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300">
						<Plus size={12} /> Create a post
					</Link>
				</div>
			) : (
				<div className="space-y-6">
					{[...groups.entries()].map(([label, groupJobs]) => (
						<div key={label}>
							<p className="text-[11px] text-zinc-600 uppercase tracking-widest font-medium mb-2">{label}</p>
							<div className="space-y-1.5">
								{groupJobs.map((job) => {
									const title = postTitles[job.post_id] || job.post_id;
									const tweetUrl = job.platform_post_id
										? `https://x.com/i/status/${job.platform_post_id}`
										: null;
									return (
										<div key={job.id} className="card rounded-xl px-4 py-3 flex items-center gap-4">
											{/* Platform */}
											<span className={`text-xs font-medium w-20 shrink-0 ${PLATFORM_COLOR[job.platform_key] || "text-zinc-400"}`}>
												{job.platform_key}
											</span>

											{/* Post title */}
											<Link
												to={`/posts/${job.post_id}`}
												className="flex-1 text-sm text-zinc-300 hover:text-amber-300 truncate"
												title={title}
											>
												{title}
											</Link>

											{/* Status badge */}
											<span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border shrink-0 ${STATUS_STYLE[job.status] || ""}`}>
												{STATUS_ICON[job.status]} {job.status}
											</span>

											{/* Time */}
											<span className="text-xs text-zinc-600 w-32 shrink-0 text-right">
												{job.status === "posted" ? fmt(job.posted_at) : fmt(job.scheduled_at)}
											</span>

											{/* Actions */}
											<div className="flex items-center gap-1 shrink-0">
												{job.status === "posted" && tweetUrl && (
													<a
														href={tweetUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="text-[11px] text-zinc-600 hover:text-sky-400 px-2 py-1 rounded hover:bg-sky-500/10 transition-colors inline-flex items-center gap-1"
													>
														<ExternalLink size={11} /> View
													</a>
												)}
												{job.status === "failed" && (
													<button
														type="button"
														onClick={() => retryJob(job.id)}
														disabled={retrying === job.id}
														className="text-[11px] text-zinc-600 hover:text-amber-400 px-2 py-1 rounded hover:bg-amber-500/10 transition-colors inline-flex items-center gap-1"
													>
														<RotateCcw size={11} className={retrying === job.id ? "animate-spin" : ""} />
														{retrying === job.id ? "…" : "Retry"}
													</button>
												)}
												{job.status === "pending" && (
													<button
														type="button"
														onClick={() => cancelJob(job.id)}
														disabled={cancelling === job.id}
														className="text-[11px] text-zinc-600 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
													>
														{cancelling === job.id ? "…" : "Cancel"}
													</button>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
