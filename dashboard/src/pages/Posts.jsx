import { useState, useEffect } from "react";
import { Trash2, Edit, Plus, Filter, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../api.js";
import { fileManager } from "../fileManager.js";
import { useFileUrl } from "../hooks/useFileUrl.js";

export default function Posts() {
	const [posts, setPosts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({});
	const [filters, setFilters] = useState({
		type: "",
		status: "",
		search: "",
	});
	const [showFilters, setShowFilters] = useState(false);

	useEffect(() => {
		loadPosts();
		loadStats();
	}, [filters]);

	const loadPosts = async () => {
		setLoading(true);
		try {
			const result = await api.listPosts({
				type: filters.type || undefined,
				status: filters.status || undefined,
				limit: 100,
			});

			let filtered = result.posts || [];

			// Client-side search
			if (filters.search) {
				const search = filters.search.toLowerCase();
				filtered = filtered.filter(
					(p) =>
						p.title.toLowerCase().includes(search) ||
						(p.metadata?.notes && p.metadata.notes.toLowerCase().includes(search))
				);
			}

			setPosts(filtered);
		} catch (err) {
			console.error("Failed to load posts:", err);
		} finally {
			setLoading(false);
		}
	};

	const loadStats = async () => {
		try {
			const result = await api.getPostStats();
			setStats(result.stats || {});
		} catch (err) {
			console.error("Failed to load stats:", err);
		}
	};

	const handleDelete = async (postId) => {
		if (!confirm("Delete this post? This cannot be undone.")) return;

		try {
			await api.deletePost(postId);
			setPosts(posts.filter((p) => p.id !== postId));
		} catch (err) {
			alert("Failed to delete post: " + err.message);
		}
	};

	const handleDuplicate = async (post) => {
		try {
			const newId = `${post.id}-copy-${Date.now()}`;
			await api.createPost({
				id: newId,
				type: post.type,
				title: `${post.title} (copy)`,
				metadata: post.metadata,
			});
			loadPosts();
		} catch (err) {
			alert("Failed to duplicate post: " + err.message);
		}
	};

	return (
		<div className="p-8 max-w-4xl">
			{/* Header */}
			<div className="mb-6">
				<div className="flex items-center justify-between mb-2">
					<h1 className="text-xl font-semibold">Posts</h1>
					<a
						href="/posts/new"
						className="btn-primary"
					>
						<Plus size={14} />
						New Post
					</a>
				</div>
				<p className="text-zinc-500 text-sm mt-0.5">Create, manage, and schedule dynamic posts</p>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-4 gap-4 mb-6">
				{[
					{ label: "Draft", value: stats.draft || 0, tone: "text-zinc-400" },
					{ label: "Queue", value: stats.queue || 0, tone: "text-blue-400" },
					{ label: "Scheduled", value: stats.scheduled || 0, tone: "text-purple-400" },
					{ label: "Posted", value: stats.posted || 0, tone: "text-emerald-400" },
				].map((stat) => (
					<div key={stat.label} className="card rounded-xl p-4">
						<p className="text-zinc-600 text-[11px] uppercase tracking-wider">{stat.label}</p>
						<p className={`text-2xl font-semibold mt-1 ${stat.tone}`}>{stat.value}</p>
					</div>
				))}
			</div>

			{/* Filters */}
			<div className="mb-6 flex items-center gap-3">
				<button
					onClick={() => setShowFilters(!showFilters)}
					className="btn-ghost border border-[#252525] h-9 px-3"
				>
					<Filter size={14} />
					Filters
				</button>

				{(filters.type || filters.status || filters.search) && (
					<button
						onClick={() =>
							setFilters({
								type: "",
								status: "",
								search: "",
							})
						}
						className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						Clear filters
					</button>
				)}
			</div>

			{showFilters && (
					<div className="mb-6 p-4 card rounded-xl space-y-4">
					{/* Type filter */}
					<div>
						<label className="block text-sm font-medium text-zinc-300 mb-2">Type</label>
						<div className="flex gap-2">
							{["standalone", "thread", "reply"].map((t) => (
								<button
									key={t}
									onClick={() => setFilters({ ...filters, type: filters.type === t ? "" : t })}
										className={`px-3 py-1 rounded-md text-sm transition-colors ${
										filters.type === t
												? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
												: "bg-[#1c1c1c] text-zinc-400 border border-[#252525] hover:text-zinc-200"
									}`}
								>
									{t}
								</button>
							))}
						</div>
					</div>

					{/* Status filter */}
					<div>
						<label className="block text-sm font-medium text-zinc-300 mb-2">Status</label>
						<div className="flex gap-2 flex-wrap">
							{["draft", "queue", "scheduled", "posted"].map((s) => (
								<button
									key={s}
									onClick={() => setFilters({ ...filters, status: filters.status === s ? "" : s })}
									className={`px-3 py-1 rounded-md text-sm transition-colors ${
										filters.status === s
											? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
											: "bg-[#1c1c1c] text-zinc-400 border border-[#252525] hover:text-zinc-200"
									}`}
								>
									{s}
								</button>
							))}
						</div>
					</div>

					{/* Search */}
					<div>
						<label className="block text-sm font-medium text-zinc-300 mb-2">Search</label>
						<input
							type="text"
							placeholder="Search by title or notes..."
							value={filters.search}
							onChange={(e) => setFilters({ ...filters, search: e.target.value })}
							className="input-field"
						/>
					</div>
				</div>
			)}

			{/* Posts List */}
			{loading ? (
				<div className="text-sm text-zinc-600 py-10">Loading posts...</div>
			) : posts.length === 0 ? (
				<div className="py-12 text-center card rounded-xl">
					<p className="text-zinc-500 mb-3">No posts yet</p>
					<a href="/posts/new" className="text-amber-400 hover:text-amber-300 text-sm">
						Create your first post →
					</a>
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

function ImageThumb({ img }) {
	const src = useFileUrl(img.file_id, img.url);
	return (
		<div className="w-16 h-16 rounded-lg overflow-hidden card flex-shrink-0">
			{src ? (
				<img src={src} alt={img.filename} className="w-full h-full object-cover" />
			) : (
				<div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">…</div>
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
		if (contentText !== null) return; // Already loaded
		
		setLoadingContent(true);
		try {
			const [postResult, imgResult] = await Promise.all([
				api.getPost(post.id),
				api.listPostImages(post.id),
		]);

			// Load text
			if (postResult.success && postResult.post.content?.length > 0) {
				const texts = await Promise.all(
					postResult.post.content.map(async (c) => {
						if (c.text_file_id) {
							const text = (await fileManager.getFileText(c.text_file_id))
								?? (await api.getFileText(c.text_file_id));
							return text || "";
						}
						return c.text || "";
					})
				);
				setContentText(texts);
			} else {
				setContentText([]);
			}

			// Load images
			setImages(imgResult?.images || []);
		} catch (err) {
			console.error("Failed to load content:", err);
			setContentText([]);
			setImages([]);
		} finally {
			setLoadingContent(false);
		}
	};

	const toggleExpand = () => {
		if (!expanded) {
			loadContent();
		}
		setExpanded(!expanded);
	};

	const statusBg = {
		draft: "bg-zinc-700/20 text-zinc-300 border border-zinc-700/30",
		queue: "bg-blue-500/10 text-blue-300 border border-blue-500/20",
		scheduled: "bg-purple-500/10 text-purple-300 border border-purple-500/20",
		posted: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
	}[post.status] || "bg-zinc-700/20 text-zinc-300 border border-zinc-700/30";

	const typeBg = {
		standalone: "bg-zinc-700/20 text-zinc-300 border border-zinc-700/30",
		thread: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20",
		reply: "bg-pink-500/10 text-pink-300 border border-pink-500/20",
	}[post.type] || "bg-zinc-700/20 text-zinc-300 border border-zinc-700/30";

	return (
		<div className="card rounded-xl overflow-hidden">
			<div className="flex items-start justify-between px-4 py-3 hover:border-zinc-700 transition-colors">
				<div className="flex-1" onClick={toggleExpand} style={{ cursor: 'pointer' }}>
					<div className="flex items-center gap-3 mb-2">
						<a
							href={`/posts/${post.id}`}
							className="text-sm font-medium text-zinc-100 hover:text-amber-400 transition-colors"
							onClick={(e) => e.stopPropagation()}
						>
							{post.title}
						</a>
						<span className={`${typeBg} text-[11px] px-2 py-0.5 rounded-md`}>{post.type}</span>
						<span className={`${statusBg} text-[11px] px-2 py-0.5 rounded-md`}>{post.status}</span>
					</div>

					{post.metadata?.notes && (
						<p className="text-xs text-zinc-500 mb-2 leading-relaxed">{post.metadata.notes}</p>
					)}

					<div className="flex items-center gap-3 text-xs text-zinc-600">
						<span>{new Date(post.created_at).toLocaleDateString()}</span>
						{post.scheduled_at && (
							<span>
								Scheduled:{" "}
								{new Date(post.scheduled_at).toLocaleString()}
							</span>
						)}
					</div>
				</div>
			{/* Expand/Collapse Chevron */}
			<button
				onClick={toggleExpand}
				className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors flex-shrink-0"
			>
				{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
			</button>
				<div className="flex items-center gap-1.5 ml-1">
					<a
						href={`/posts/${post.id}`}
						className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
						title="Edit"
					>
						<Edit size={14} />
					</a>
					<button
						onClick={onDuplicate}
						className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
						title="Duplicate"
					>
						<Copy size={14} />
					</button>
					<button
						onClick={onDelete}
						className="p-1.5 rounded-md text-zinc-600 hover:text-red-300 hover:bg-red-500/10 transition-colors"
						title="Delete"
					>
						<Trash2 size={14} />
					</button>
				</div>
			</div>

			{/* Expanded content section */}
			{expanded && (
				<div className="px-4 pb-4 pt-1 border-t border-[#1e1e1e]">
					{loadingContent ? (
						<p className="text-xs text-zinc-600">Loading content...</p>
					) : (
						<>
							{/* Text */}
							{contentText && contentText.length > 0 && (
								<div className="space-y-3 mb-3">
									{post.type === "thread" && contentText.length > 1 ? (
										contentText.map((text, idx) => (
											<div key={idx} className="border-l-2 border-amber-400/30 pl-3">
												<p className="text-xs text-zinc-500 mb-1">Tweet {idx + 1}</p>
												<p className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">{text}</p>
											</div>
										))
									) : (
										<p className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">{contentText[0]}</p>
									)}
								</div>
							)}
							{/* Images */}
							{images && images.length > 0 && (
								<div className="flex flex-wrap gap-2 mt-2">
									{images.map((img) => (
										<ImageThumb key={img.id} img={img} />
									))}
								</div>
							)}
							{(!contentText || contentText.length === 0) && (!images || images.length === 0) && (
								<p className="text-xs text-zinc-600 italic">No content</p>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
