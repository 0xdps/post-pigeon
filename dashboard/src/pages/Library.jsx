import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	PenLine, Search, Loader2, Trash2, RotateCcw, ExternalLink,
	Clock, CheckCircle2, FileText, Calendar, AlertCircle, RefreshCw,
} from "lucide-react";
import { api } from "../api.js";

const PLATFORMS = {
	twitter:  { label: "X",        color: "#000", bg: "#e7e7e7" },
	bluesky:  { label: "Bk",       color: "#0085ff", bg: "#daeeff" },
	linkedin: { label: "in",       color: "#0077b5", bg: "#dbeafe" },
	devto:    { label: "D",        color: "#3b49df", bg: "#eceffe" },
	reddit:   { label: "Rd",       color: "#ff4500", bg: "#fff0eb" },
	threads:  { label: "Th",       color: "#8b5cf6", bg: "#f3e8ff" },
};

const STATUS_TABS = [
	{ id: "all",       label: "All posts",  icon: FileText    },
	{ id: "draft",     label: "Drafts",     icon: FileText    },
	{ id: "scheduled", label: "Scheduled",  icon: Calendar    },
	{ id: "posted",    label: "Published",  icon: CheckCircle2 },
];

function PlatformDot({ platformKey }) {
	const p = PLATFORMS[platformKey];
	if (!p) return null;
	return (
		<span
			className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold shrink-0"
			style={{ background: p.bg, color: p.color }}
			title={p.label}
		>
			{p.label}
		</span>
	);
}

function StatusBadge({ status }) {
	const cfg = {
		draft:     { label: "Draft",     color: "var(--text-3)",  bg: "var(--bg-3)",      icon: FileText     },
		scheduled: { label: "Scheduled", color: "var(--amber)",   bg: "rgba(245,158,11,0.08)", icon: Clock   },
		posted:    { label: "Published", color: "var(--green)",   bg: "rgba(52,211,153,0.08)", icon: CheckCircle2 },
	}[status] || { label: status, color: "var(--text-3)", bg: "var(--bg-3)", icon: FileText };
	const Icon = cfg.icon;
	return (
		<span
			className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
			style={{ background: cfg.bg, color: cfg.color }}
		>
			<Icon size={9} />
			{cfg.label}
		</span>
	);
}

function TypeBadge({ type }) {
	if (type === "standalone") return null;
	return (
		<span
			className="text-[10px] font-bold px-1.5 py-0.5 rounded"
			style={{ background: "var(--accent-dim2)", color: "var(--accent)" }}
		>
			{type === "thread" ? "Thread" : type}
		</span>
	);
}

function PostCard({ post, jobs, onDelete, onRepost }) {
	const navigate = useNavigate();
	const [deleting, setDeleting] = useState(false);
	const [reposting, setReposting] = useState(false);

	const preview = post.title || "Untitled draft";
	const meta = post.metadata || {};
	const platforms = meta.platforms || [];
	const isPublished = post.status === "posted";
	const isScheduled = post.status === "scheduled";

	const postJobs = jobs.filter(j => j.post_id === post.id);
	const nextJob = postJobs.find(j => j.status === "pending" || j.status === "processing");
	const allPosted = postJobs.every(j => j.status === "posted");
	const hasFailed = postJobs.some(j => j.status === "failed");

	const handleDelete = async (e) => {
		e.stopPropagation();
		if (!window.confirm("Delete this post? This cannot be undone.")) return;
		setDeleting(true);
		await api.deletePost(post.id);
		onDelete(post.id);
	};

	const handleRepost = async (e) => {
		e.stopPropagation();
		setReposting(true);
		// Navigate to compose with this post pre-loaded for reposting
		navigate(`/compose/${post.id}`);
	};

	const handleCardClick = () => {
		navigate(`/compose/${post.id}`);
	};

	const formatDate = (ts) => {
		if (!ts) return null;
		const d = new Date(ts);
		const now = new Date();
		const diff = now - d;
		if (diff < 60000) return "just now";
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
		return d.toLocaleDateString("en", { month: "short", day: "numeric" });
	};

	const scheduledTime = nextJob?.scheduled_at
		? new Date(nextJob.scheduled_at).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
		: null;

	return (
		<div
			onClick={handleCardClick}
			className="group flex flex-col rounded-xl cursor-pointer transition-all"
			style={{
				background: "var(--bg-2)",
				border: "1px solid var(--border)",
				overflow: "hidden",
			}}
			onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-2)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
			onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; }}
		>
			{/* Card body — content preview */}
			<div className="flex-1 p-4">
				{/* Top: status + type + date */}
				<div className="flex items-center gap-2 mb-3">
					<StatusBadge status={post.status} />
					<TypeBadge type={post.type} />
					{hasFailed && (
						<span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--red-dim)", color: "var(--red)" }}>
							<AlertCircle size={9} /> Partial fail
						</span>
					)}
					<span className="ml-auto text-[11px]" style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
						{formatDate(post.updated_at || post.created_at)}
					</span>
				</div>

				{/* Content preview */}
				<p
					className="text-sm leading-relaxed mb-3 line-clamp-3"
					style={{ color: "var(--text-2)" }}
				>
					{preview}
				</p>

				{/* Tags */}
				{meta.tags?.length > 0 && (
					<div className="flex flex-wrap gap-1 mb-3">
						{meta.tags.slice(0, 4).map(t => (
							<span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-dim2)", color: "var(--accent)" }}>
								#{t}
							</span>
						))}
					</div>
				)}

				{/* Platform chips */}
				{platforms.length > 0 && (
					<div className="flex items-center gap-1">
						{platforms.map(k => <PlatformDot key={k} platformKey={k} />)}
					</div>
				)}
			</div>

			{/* Card footer — contextual actions */}
			<div
				className="flex items-center justify-between px-4 py-2.5"
				style={{ borderTop: "1px solid var(--border)", background: "var(--bg-3)" }}
				onClick={e => e.stopPropagation()}
			>
				{/* Scheduling info */}
				<div className="text-[11px]" style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
					{scheduledTime && !isPublished && (
						<span className="flex items-center gap-1">
							<Clock size={10} style={{ color: "var(--amber)" }} />
							{scheduledTime}
						</span>
					)}
					{isPublished && allPosted && (
						<span className="flex items-center gap-1" style={{ color: "var(--green)" }}>
							<CheckCircle2 size={10} />
							All published
						</span>
					)}
					{!scheduledTime && !isPublished && (
						<span>Draft</span>
					)}
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1">
					{isPublished ? (
						<>
							<button
								onClick={handleRepost}
								disabled={reposting}
								className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors"
								style={{ color: "var(--text-3)" }}
								onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim2)"; }}
								onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
							>
								<RotateCcw size={10} />
								Repost
							</button>
						</>
					) : (
						<>
							<Link
								to={`/compose/${post.id}`}
								className="text-[11px] px-2 py-1 rounded transition-colors"
								style={{ color: "var(--text-3)" }}
								onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "var(--bg-4)"; }}
								onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
							>
								Edit
							</Link>
							<button
								onClick={handleDelete}
								disabled={deleting}
								className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors"
								style={{ color: "var(--text-3)" }}
								onMouseEnter={e => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-dim)"; }}
								onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
							>
								{deleting ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

export default function Library() {
	const [posts, setPosts] = useState([]);
	const [jobs, setJobs] = useState([]);
	const [stats, setStats] = useState({});
	const [activeTab, setActiveTab] = useState("all");
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		const [postsRes, jobsRes, statsRes] = await Promise.all([
			api.listPosts({ limit: 100, orderBy: "updated_at" }),
			api.listPublishJobs({ limit: 200 }),
			api.getPostStats(),
		]);
		const allPosts = Array.isArray(postsRes) ? postsRes : (postsRes?.posts || []);
		const allJobs = Array.isArray(jobsRes) ? jobsRes : (jobsRes?.jobs || []);
		setPosts(allPosts);
		setJobs(allJobs);
		setStats(statsRes || {});
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	const handleDelete = (postId) => {
		setPosts(prev => prev.filter(p => p.id !== postId));
	};

	const handleRepost = () => {};

	// Filter posts
	const filtered = posts.filter(p => {
		const matchesTab = activeTab === "all" || p.status === activeTab;
		const matchesSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase());
		return matchesTab && matchesSearch;
	});

	const counts = {
		all:       posts.length,
		draft:     posts.filter(p => p.status === "draft").length,
		scheduled: posts.filter(p => p.status === "scheduled").length,
		posted:    posts.filter(p => p.status === "posted").length,
	};

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
							<h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Posts</h1>
							<p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
								{counts.all} total · {counts.draft} drafts · {counts.scheduled} scheduled · {counts.posted} published
							</p>
						</div>
						<div className="flex items-center gap-3">
					<button onClick={load} className="btn-icon" title="Refresh">
							<RefreshCw size={14} />
						</button>
							<Link to="/compose" className="btn-primary flex items-center gap-2 text-sm">
								<PenLine size={13} />
								Write a post
							</Link>
						</div>
					</div>

					{/* Status tabs */}
					<div className="flex items-center gap-0">
						{STATUS_TABS.map(({ id, label, icon: Icon }) => (
							<button
								key={id}
								onClick={() => setActiveTab(id)}
								className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
								style={{
									color: activeTab === id ? "var(--accent)" : "var(--text-3)",
									borderColor: activeTab === id ? "var(--accent)" : "transparent",
									background: "transparent",
								}}
							>
								<Icon size={12} />
								{label}
								<span
									className="text-xs px-1.5 py-0.5 rounded-full font-mono"
									style={{
										background: activeTab === id ? "var(--accent-dim2)" : "var(--bg-3)",
										color: activeTab === id ? "var(--accent)" : "var(--text-3)",
									}}
								>
									{counts[id]}
								</span>
							</button>
						))}
					</div>
				</div>
			</div>

			{/* ── Search bar ── */}
			<div className="px-8 py-4">
				<div className="relative max-w-sm">
					<Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
					<input
						type="text"
						placeholder="Search posts…"
						value={search}
						onChange={e => setSearch(e.target.value)}
						className="w-full text-sm py-2 pl-9 pr-3 rounded-lg"
						style={{
							background: "var(--bg-2)",
							border: "1px solid var(--border)",
							color: "var(--text)",
							outline: "none",
						}}
						onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
						onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
					/>
				</div>
			</div>

			{/* ── Grid ── */}
			<div className="px-8 pb-12">
				{loading ? (
					<div className="flex items-center justify-center py-24">
						<Loader2 size={20} className="animate-spin" style={{ color: "var(--text-3)" }} />
					</div>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-24 text-center">
						{search ? (
							<>
								<Search size={32} style={{ color: "var(--text-3)" }} className="mb-3" />
								<p className="text-sm" style={{ color: "var(--text-3)" }}>No posts match "{search}"</p>
							</>
						) : (
							<>
								<PenLine size={32} style={{ color: "var(--text-3)" }} className="mb-3" />
								<p className="font-medium mb-1" style={{ color: "var(--text-2)" }}>
									{activeTab === "all" ? "No posts yet" : `No ${activeTab} posts`}
								</p>
								<p className="text-sm mb-4" style={{ color: "var(--text-3)" }}>
									{activeTab === "all" ? "Start writing and your posts will appear here." : `Posts with "${activeTab}" status appear here.`}
								</p>
								<Link to="/compose" className="btn-primary flex items-center gap-2 text-sm">
									<PenLine size={13} />
									Write your first post
								</Link>
							</>
						)}
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{filtered.map(post => (
							<PostCard
								key={post.id}
								post={post}
								jobs={jobs}
								onDelete={handleDelete}
								onRepost={handleRepost}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
