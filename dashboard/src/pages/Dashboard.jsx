import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Plus, RefreshCw } from "lucide-react";
import { api } from "../api.js";

const STATUS_STYLE = {
	pending:   { text: "text-amber-300",   bg: "bg-amber-400/10",   border: "border-amber-400/20"   },
	posted:    { text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/20"  },
	failed:    { text: "text-red-300",     bg: "bg-red-400/10",     border: "border-red-400/20"      },
	cancelled: { text: "text-zinc-500",    bg: "bg-zinc-700/20",    border: "border-zinc-700/30"     },
};

const PLATFORM_COLOR = {
	twitter:  "text-blue-300",
	threads:  "text-violet-300",
	linkedin: "text-sky-300",
	reddit:   "text-orange-300",
	devto:    "text-zinc-300",
	github:   "text-emerald-300",
};

function fmt(ts) {
	if (!ts) return "—";
	const d = new Date(ts);
	const today = new Date();
	if (d.toDateString() === today.toDateString()) {
		return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}
	return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
	const [jobs, setJobs]             = useState([]);
	const [stats, setStats]           = useState({});
	const [postTitles, setPostTitles] = useState({});
	const [todays, setTodays]         = useState({ count: 0, limit: 10 });
	const [loading, setLoading]       = useState(true);

	const load = useCallback(async () => {
		try {
			const [jobsRes, statsRes, postsRes, stateRes, settingsRes] = await Promise.all([
				api.listPublishJobs({ limit: 100 }),
				api.getPostStats(),
				api.listPosts({ limit: 500 }),
				api.getState(),
				api.getSettings(),
			]);
			setJobs(jobsRes?.jobs || []);
			setStats(statsRes?.stats || {});
			const map = {};
			for (const p of postsRes?.posts || []) map[p.id] = p.title || p.id;
			setPostTitles(map);
			setTodays({ count: stateRes?.posts_today || 0, limit: settingsRes?.daily_limit || 10 });
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

	const upcoming = jobs
		.filter((j) => j.status === "pending")
		.sort((a, b) => a.scheduled_at - b.scheduled_at)
		.slice(0, 8);

	const recent = jobs
		.filter((j) => j.status === "posted" || j.status === "failed")
		.sort((a, b) => (b.posted_at || b.scheduled_at) - (a.posted_at || a.scheduled_at))
		.slice(0, 8);

	const failedCount = jobs.filter((j) => j.status === "failed").length;

	if (loading) {
		return (
<div className="p-8 animate-pulse space-y-6 max-w-5xl">
				<div className="h-7 w-40 bg-zinc-800 rounded" />
				<div className="grid grid-cols-4 gap-4">
					{[0,1,2,3].map((i) => <div key={i} className="h-24 card rounded-xl" />)}
				</div>
			</div>
		);
	}

	return (
<div className="p-8 max-w-5xl">
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-xl font-semibold">Dashboard</h1>
					<p className="text-zinc-500 text-sm mt-0.5">
						{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button onClick={load} className="btn-ghost border border-[#252525]">
						<RefreshCw size={14} />
					</button>
					<Link to="/posts/new" className="btn-primary">
						<Plus size={14} /> New Post
					</Link>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-4 gap-4 mb-8">
				{[
				{ label: "Draft",  value: stats.draft  || 0, tone: "text-zinc-400"    },
				{ label: "Today",  value: `${todays.count}/${todays.limit}`, tone: todays.count >= todays.limit ? "text-red-400" : todays.count > 0 ? "text-amber-400" : "text-emerald-400" },
				{ label: "Posted", value: stats.posted || 0, tone: "text-emerald-400" },
				{ label: "Failed", value: failedCount,       tone: failedCount > 0 ? "text-red-400" : "text-zinc-600" },
				].map((s) => (
<div key={s.label} className="card rounded-xl p-4">
						<p className="text-zinc-600 text-[11px] uppercase tracking-wider mb-1">{s.label}</p>
						<p className={`text-2xl font-semibold ${s.tone}`}>{s.value}</p>
					</div>
				))}
			</div>

			<div className="grid grid-cols-2 gap-6">
				{/* Upcoming */}
				<div>
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
							<Clock size={12} /> Upcoming
						</h2>
					<Link to="/queue" className="text-xs text-zinc-600 hover:text-amber-400 transition-colors">
							See all →
						</Link>
					</div>
					{upcoming.length === 0 ? (
<div className="card rounded-xl px-4 py-8 text-center">
							<p className="text-sm text-zinc-600 mb-3">Nothing scheduled yet</p>
							<Link to="/posts/new" className="text-xs text-amber-400 hover:text-amber-300">
								Create a post →
							</Link>
						</div>
					) : (
<div className="space-y-1.5">
							{upcoming.map((job) => (
<JobRow key={job.id} job={job} postTitles={postTitles} />
							))}
						</div>
					)}
				</div>

				{/* Recent */}
				<div>
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
							<CheckCircle2 size={12} /> Recent
						</h2>
					<Link to="/queue" className="text-xs text-zinc-600 hover:text-emerald-400 transition-colors">
							See all →
						</Link>
					</div>
					{recent.length === 0 ? (
<div className="card rounded-xl px-4 py-8 text-center">
							<p className="text-sm text-zinc-600">No posts sent yet</p>
						</div>
					) : (
<div className="space-y-1.5">
							{recent.map((job) => (
<JobRow key={job.id} job={job} showPostedAt postTitles={postTitles} />
							))}
						</div>
					)}
				</div>
			</div>

</div>
	);
}

function JobRow({ job, showPostedAt = false, postTitles = {} }) {
	const s = STATUS_STYLE[job.status] || STATUS_STYLE.cancelled;
	const color = PLATFORM_COLOR[job.platform_key] || "text-zinc-400";
	const ts = showPostedAt ? job.posted_at : job.scheduled_at;
	const title = postTitles[job.post_id] || job.post_id;

	return (
<div className="card rounded-lg px-3 py-2 flex items-center gap-3">
			<span className={`text-xs font-medium ${color} w-16 flex-shrink-0 truncate`}>
				{job.platform_key}
			</span>
			<span className="flex-1 text-xs text-zinc-400 truncate" title={title}>
				{title}
			</span>
			<span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${s.bg} ${s.text} ${s.border}`}>
				{job.status}
			</span>
			<span className="text-[11px] text-zinc-600 flex-shrink-0 w-20 text-right">
				{fmt(ts)}
			</span>
		</div>
	);
}
