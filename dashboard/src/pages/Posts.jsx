import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trash2, Edit3, Plus, Copy, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { api } from "../api.js";
import { fileManager } from "../fileManager.js";
import { useFileUrl } from "../hooks/useFileUrl.js";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const STATUS_BADGE = {
	draft:     { label: "Draft",     style: "badge-draft"     },
	queue:     { label: "Queue",     style: "badge-queue"     },
	scheduled: { label: "Scheduled", style: "badge-scheduled" },
	posted:    { label: "Posted",    style: "badge-posted"    },
};

const TYPE_BADGE = {
	standalone: { label: "Post",   color: "var(--text-3)" },
	thread:     { label: "Thread", color: "var(--blue)"   },
	reply:      { label: "Reply",  color: "var(--amber)"  },
};

function fmtDate(ts) {
	return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ── PostCard ─────────────────────────────────────────────────────────────── */

function ImageThumb({ img }) {
	const src = useFileUrl(img.file_id, img.url);
	return (
		<div className="w-14 h-14 rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
			{src ? (
				<img src={src} alt={img.filename} className="w-full h-full object-cover" />
			) : (
				<div className="w-full h-full flex items-center justify-center text-[10px]" style={{ color: "var(--text-3)" }}>…</div>
			)}
		</div>
	);
}

function PostCard({ post, onDelete, onDuplicate }) {
	const [expanded, setExpanded] = useState(false);
	const [contentText, setContentText] = useState(null);
	const [images, setImages] = useState(null);
	const [loadingContent, setLoadingContent] = useState(false);

	const loadContent = async () => {
		if (contentText !== null) return;
		setLoadingContent(true);
		try {
			const [postResult, imgResult] = await Promise.all([
				api.getPost(post.id),
				api.listPostImages(post.id),
			]);
			if (postResult.success && postResult.post.content?.length > 0) {
				const texts = await Promise.all(
					postResult.post.content.map(async (c) => {
						if (c.text_file_id) {
							const text = (await fileManager.getFileText(c.text_file_id)) ?? (await api.getFileText(c.text_file_id));
							return text || "";
						}
						return c.text || "";
					})
				);
				setContentText(texts);
			} else {
				setContentText([]);
			}
			setImages(imgResult?.images || []);
		} catch {
			setContentText([]);
			setImages([]);
		} finally {
			setLoadingContent(false);
		}
	};

	const toggle = () => {
		if (!expanded) loadContent();
		setExpanded(!expanded);
	};

	const sb = STATUS_BADGE[post.status] || STATUS_BADGE.draft;
	const tb = TYPE_BADGE[post.type] || TYPE_BADGE.standalone;

	return (
		<div
			className="rounded-xl overflow-hidden transition-all"
			style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
		>
			{/* Main row */}
			<div className="flex items-center gap-3 px-4 py-3">
				{/* Expand toggle */}
				<button
					onClick={toggle}
					className="shrink-0 transition-colors"
					style={{ color: "var(--text-3)" }}
				>
					{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
				</button>

				{/* Type indicator */}
				<span
					className="text-[10px] font-mono font-semibold uppercase shrink-0"
					style={{ color: tb.color, minWidth: 44 }}
				>
					{tb.label}
				</span>

				{/* Title */}
				<Link
					to={`/posts/${post.id}`}
					className="flex-1 text-sm font-medium truncate hover:underline"
					style={{ color: "var(--text)" }}
				>
					{post.title}
				</Link>

				{/* Meta */}
				<span className="text-xs shrink-0 font-mono" style={{ color: "var(--text-3)" }}>
					{fmtDate(post.updated_at || post.created_at)}
				</span>

				{/* Status */}
				<span className={`badge ${sb.style} shrink-0`}>{sb.label}</span>

				{/* Actions */}
				<div className="flex items-center gap-0.5 shrink-0">
					<Link
						to={`/posts/${post.id}`}
						className="p-1.5 rounded-md transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
						title="Edit"
					>
						<Edit3 size={13} />
					</Link>
					<button
						onClick={onDuplicate}
						className="p-1.5 rounded-md transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
						title="Duplicate"
					>
						<Copy size={13} />
					</button>
					<button
						onClick={onDelete}
						className="p-1.5 rounded-md transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-dim)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
						title="Delete"
					>
						<Trash2 size={13} />
					</button>
				</div>
			</div>

			{/* Expanded content */}
			{expanded && (
				<div
					className="px-4 pb-4 pt-3"
					style={{ borderTop: "1px solid var(--border)" }}
				>
					{loadingContent ? (
						<p className="text-xs" style={{ color: "var(--text-3)" }}>Loading…</p>
					) : (
						<>
							{contentText && contentText.length > 0 && (
								<div className="space-y-3 mb-3">
									{post.type === "thread" && contentText.length > 1 ? (
										contentText.map((text, idx) => (
											<div key={idx} className="pl-3" style={{ borderLeft: "2px solid var(--accent-dim2)" }}>
												<p className="text-[10px] font-mono mb-1" style={{ color: "var(--text-3)" }}>
													{idx + 1}
												</p>
												<p className="text-sm whitespace-pre-wrap font-mono leading-relaxed" style={{ color: "var(--text-2)" }}>
													{text}
												</p>
											</div>
										))
									) : (
										<p className="text-sm whitespace-pre-wrap font-mono leading-relaxed" style={{ color: "var(--text-2)" }}>
											{contentText[0]}
										</p>
									)}
								</div>
							)}
							{images && images.length > 0 && (
								<div className="flex flex-wrap gap-2 mt-2">
									{images.map((img) => <ImageThumb key={img.id} img={img} />)}
								</div>
							)}
							{(!contentText?.length && !images?.length) && (
								<p className="text-xs italic" style={{ color: "var(--text-3)" }}>No content yet</p>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

const STATUSES = ["draft", "queue", "scheduled", "posted"];
const TYPES    = ["standalone", "thread", "reply"];

export default function Posts() {
	const [posts, setPosts]   = useState([]);
	const [loading, setLoading] = useState(true);
	const [stats, setStats]   = useState({});
	const [activeStatus, setActiveStatus] = useState("");
	const [activeType, setActiveType]     = useState("");
	const [search, setSearch] = useState("");

	const load = async () => {
		setLoading(true);
		try {
			const [postsRes, statsRes] = await Promise.all([
				api.listPosts({ status: activeStatus || undefined, type: activeType || undefined, limit: 100 }),
				api.getPostStats(),
			]);
			let list = postsRes?.posts || [];
			if (search) {
				const q = search.toLowerCase();
				list = list.filter((p) =>
					p.title.toLowerCase().includes(q) ||
					(p.metadata?.notes && p.metadata.notes.toLowerCase().includes(q))
				);
			}
			setPosts(list);
			setStats(statsRes?.stats || {});
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, [activeStatus, activeType, search]); // eslint-disable-line

	const handleDelete = async (postId) => {
		if (!confirm("Delete this post? This cannot be undone.")) return;
		try {
			await api.deletePost(postId);
			setPosts((prev) => prev.filter((p) => p.id !== postId));
		} catch (err) {
			alert("Failed to delete: " + err.message);
		}
	};

	const handleDuplicate = async (post) => {
		try {
			const newId = `${post.id}-copy-${Date.now()}`;
			await api.createPost({ id: newId, type: post.type, title: `${post.title} (copy)`, metadata: post.metadata });
			load();
		} catch (err) {
			alert("Failed to duplicate: " + err.message);
		}
	};

	const totalPosts = Object.values(stats).reduce((s, v) => s + (v || 0), 0);
	const hasFilter = activeStatus || activeType || search;

	return (
		<div className="p-8 max-w-4xl mx-auto animate-fade-up">

			{/* ── Header ── */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>Library</h1>
					<p className="text-sm mt-0.5" style={{ color: "var(--text-2)" }}>
						{totalPosts} post{totalPosts !== 1 ? "s" : ""} total
					</p>
				</div>
				<Link to="/posts/new" className="btn-primary">
					<Plus size={14} /> New Post
				</Link>
			</div>

			{/* ── Stats strip ── */}
			<div className="grid grid-cols-4 gap-2 mb-6">
				{[
					{ key: "draft",     label: "Drafts",    color: "var(--text-3)" },
					{ key: "queue",     label: "Queued",    color: "var(--amber)"  },
					{ key: "scheduled", label: "Scheduled", color: "var(--blue)"   },
					{ key: "posted",    label: "Posted",    color: "var(--green)"  },
				].map(({ key, label, color }) => (
					<button
						key={key}
						onClick={() => setActiveStatus((s) => s === key ? "" : key)}
						className="rounded-xl p-3 text-left transition-all"
						style={{
							background: activeStatus === key ? "var(--accent-dim)" : "var(--bg-2)",
							border: `1px solid ${activeStatus === key ? "rgba(168,230,61,0.2)" : "var(--border)"}`,
						}}
					>
						<p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "var(--text-3)" }}>{label}</p>
						<p className="text-xl font-bold font-mono" style={{ color: activeStatus === key ? "var(--accent)" : color }}>
							{stats[key] || 0}
						</p>
					</button>
				))}
			</div>

			{/* ── Filters + Search ── */}
			<div className="flex items-center gap-3 mb-5">
				{/* Type chips */}
				<div className="flex items-center gap-1.5">
					{TYPES.map((t) => (
						<button
							key={t}
							onClick={() => setActiveType((v) => v === t ? "" : t)}
							className="px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize"
							style={{
								background: activeType === t ? "var(--accent-dim2)" : "transparent",
								color: activeType === t ? "var(--accent)" : "var(--text-3)",
								border: `1px solid ${activeType === t ? "rgba(168,230,61,0.3)" : "var(--border-2)"}`,
							}}
						>
							{t}
						</button>
					))}
				</div>

				<div className="h-4 w-px" style={{ background: "var(--border-2)" }} />

				{/* Search */}
				<div className="flex-1 relative max-w-xs">
					<Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search posts…"
						className="input-field pl-8 pr-8 py-1.5 text-xs"
					/>
					{search && (
						<button
							onClick={() => setSearch("")}
							className="absolute right-3 top-1/2 -translate-y-1/2"
							style={{ color: "var(--text-3)" }}
						>
							<X size={12} />
						</button>
					)}
				</div>

				{hasFilter && (
					<button
						onClick={() => { setActiveStatus(""); setActiveType(""); setSearch(""); }}
						className="text-xs transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-2)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}
					>
						Clear
					</button>
				)}
			</div>

			{/* ── Post list ── */}
			{loading ? (
				<div className="py-12 text-sm text-center" style={{ color: "var(--text-3)" }}>Loading…</div>
			) : posts.length === 0 ? (
				<div
					className="py-16 text-center rounded-xl"
					style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
				>
					<p className="text-sm mb-3" style={{ color: "var(--text-3)" }}>
						{hasFilter ? "No posts match your filters" : "No posts yet"}
					</p>
					{!hasFilter && (
						<Link to="/posts/new" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--accent)" }}>
							<Plus size={11} /> Create your first post
						</Link>
					)}
				</div>
			) : (
				<div className="space-y-1.5">
					{posts.map((post) => (
						<PostCard
							key={post.id}
							post={post}
							onDelete={() => handleDelete(post.id)}
							onDuplicate={() => handleDuplicate(post)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
