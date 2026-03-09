import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Save, X, Loader, Send, Clock, ArrowLeft, CheckCircle, CopyPlus } from "lucide-react";
import { api } from "../api.js";
import ImageUpload from "../components/ImageUpload.jsx";
import ThreadBuilder from "../components/ThreadBuilder.jsx";
import { SecureImage } from "../components/SecureImage.jsx";
import { fileManager } from "../fileManager.js";

// Platform definitions (mirrors server catalog — avoids a round-trip for the static list)
const KNOWN_PLATFORMS = [
	{ key: "twitter",  label: "X / Twitter", color: "text-blue-300",    bg: "bg-blue-400/10"    },
	{ key: "threads",  label: "Threads",      color: "text-violet-300", bg: "bg-violet-400/10" },
	{ key: "linkedin", label: "LinkedIn",     color: "text-sky-300",    bg: "bg-sky-400/10"    },
	{ key: "reddit",   label: "Reddit",       color: "text-orange-300", bg: "bg-orange-400/10" },
	{ key: "devto",    label: "Dev.to",       color: "text-zinc-300",   bg: "bg-zinc-700/40"   },
	{ key: "github",   label: "GitHub",       color: "text-emerald-300",bg: "bg-emerald-400/10"},
];

function newPostDefaults() {
	return {
		id: `post-${Date.now()}`,
		type: "standalone",
		title: "",
		status: "draft",
		metadata: { tags: [], category: "", notes: "" },
		content: [{ id: "content-1", text: "", media_ids: [], sequence: 1 }],
	};
}

export default function PostEditor() {
	const { id: postId } = useParams();
	const navigate = useNavigate();

	const [post, setPost]         = useState(null);
	const [loading, setLoading]   = useState(!!postId);
	const [saving, setSaving]     = useState(false);
	const [saved, setSaved]       = useState(false);
	const [images, setImages]     = useState([]);

	// Platform states from API
	const [platformStatuses, setPlatformStatuses] = useState({}); // key → { enabled, auth_status }
	const [selectedPlatforms, setSelectedPlatforms] = useState(["twitter"]);
	const [publishedJobs, setPublishedJobs]         = useState([]); // jobs with status=posted for this post

	// Schedule
	const [scheduleMode, setScheduleMode] = useState("draft"); // draft | now | fixed | random
	const [scheduledAt, setScheduledAt]   = useState("");
	const [windowStart, setWindowStart]   = useState("09:00");
	const [windowEnd, setWindowEnd]       = useState("21:00");

	// Notes collapse
	const [showNotes, setShowNotes] = useState(false);

	// ── Load ────────────────────────────────────────────────────────────────
	useEffect(() => {
		loadPlatforms();
		if (postId) {
			loadPost();
		} else {
			setPost(newPostDefaults());
			setLoading(false);
		}
	}, [postId]);

	const loadPlatforms = async () => {
		try {
			const result = await api.getPlatforms();
			const map = {};
			for (const p of result?.platforms || []) {
				map[p.key] = { enabled: !!p.enabled, auth_status: p.auth_status };
			}
			setPlatformStatuses(map);
		} catch { /* silent — platforms are optional */ }
	};

	const loadPost = async () => {
		try {
			const result = await api.getPost(postId);
			if (!result?.success) return;
			const contentWithText = await Promise.all(
				(result.post.content || []).map(async (c) => {
					if (c.text_file_id) {
						const text = (await fileManager.getFileText(c.text_file_id))
							?? (await api.getFileText(c.text_file_id));
						return { ...c, text: text || "" };
					}
					return c;
				})
			);
			setPost({ ...result.post, content: contentWithText });
			const imgResult = await api.listPostImages(postId);
			if (imgResult?.success) setImages(imgResult.images || []);
			// Load publish history so we know which platforms were already posted to
			const jobsResult = await api.listPublishJobs({ post_id: postId });
			const posted = (jobsResult?.jobs || []).filter((j) => j.status === "posted");
			setPublishedJobs(posted);
			// Pre-deselect platforms that were already posted
			const postedKeys = new Set(posted.map((j) => j.platform_key));
			setSelectedPlatforms((prev) => prev.filter((k) => !postedKeys.has(k)));
		} catch (err) {
			console.error("Failed to load post:", err);
		} finally {
			setLoading(false);
		}
	};

	// ── Updaters ─────────────────────────────────────────────────────────────
	const set     = (key, val) => setPost((p) => ({ ...p, [key]: val }));
	const setMeta = (key, val) => setPost((p) => ({ ...p, metadata: { ...p.metadata, [key]: val } }));

	const updateContent = (index, updates) => {
		const updated = [...(post.content || [])];
		updated[index] = { ...updated[index], ...updates };
		set("content", updated);
	};

	const togglePlatform = (key) => {
		if (!platformStatuses[key]?.enabled) return;
		setSelectedPlatforms((prev) =>
			prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
		);
	};

	// ── Save / Schedule / Publish ────────────────────────────────────────────
	const savePost = async () => {
		setSaving(true);
		setSaved(false);
		try {
			const currentId = postId || post.id;
			if (postId) {
				await api.updatePost(postId, {
					title: post.title,
					type: post.type,
					status: post.status,
					metadata: post.metadata,
				});
				// Sync content: DB items have ids with format "content-{ts}-{random}" (3 dash-parts);
				// items added in-session have only 2 dash-parts and need to be inserted.
				for (const c of post.content || []) {
					if (!c.text?.trim()) continue;
					const isDbItem = c.id && c.id.split("-").length === 3;
					if (isDbItem) {
						await api.updatePostContent(postId, c.id, {
							text: c.text,
							media_ids: c.media_ids || [],
							sequence: c.sequence,
							reply_to_tweet_id: c.reply_to_tweet_id || null,
						});
					} else {
						await api.addPostContent(postId, {
							text: c.text,
							media_ids: c.media_ids || [],
							sequence: c.sequence,
							reply_to_tweet_id: c.reply_to_tweet_id || null,
						});
					}
				}
			} else {
				await api.createPost({ id: post.id, type: post.type, title: post.title, metadata: post.metadata });
				for (const c of post.content || []) {
					if (c.text?.trim()) {
						await api.addPostContent(post.id, {
							text: c.text,
							media_ids: c.media_ids || [],
							sequence: c.sequence,
							reply_to_tweet_id: c.reply_to_tweet_id || null,
						});
					}
				}
			}
			setSaved(true);
			setTimeout(() => setSaved(false), 2500);
			return currentId;
		} catch (err) {
			alert("Failed to save: " + err.message);
			return null;
		} finally {
			setSaving(false);
		}
	};

	const handleAction = async () => {
		if (scheduleMode === "draft") {
			await savePost();
			return;
		}
		const savedId = await savePost();
		if (!savedId) return;
		if (selectedPlatforms.length === 0) { alert("Select at least one platform."); return; }
		if (scheduleMode === "fixed" && !scheduledAt) { alert("Pick a date and time."); return; }

		const platforms = selectedPlatforms.map((key) => {
			if (scheduleMode === "fixed")  return { key, mode: "fixed",  scheduled_at: new Date(scheduledAt).getTime() };
			if (scheduleMode === "random") return { key, mode: "random", window_start: windowStart, window_end: windowEnd };
			// now
			return { key, mode: "fixed", scheduled_at: Date.now() + 3000 };
		});

		try {
			const result = await api.createSchedule({ post_id: savedId, platforms });
			if (scheduleMode === "now") {
				for (const job of result?.jobs || []) {
					await api.publishJob(job.job_id);
				}
			}
			navigate("/posts");
		} catch (err) {
			alert("Failed: " + err.message);
		}
	};

	const handleImagesUploaded = (uploaded) => setImages((prev) => [...prev, ...uploaded]);

	// Duplicate a posted post as a fresh draft and navigate to it
	const duplicateAsDraft = async () => {
		setSaving(true);
		try {
			const newId = `post-${Date.now()}`;
			await api.createPost({
				id: newId,
				type: post.type,
				title: `${post.title} (copy)`,
				metadata: { ...post.metadata },
			});
			for (const c of post.content || []) {
				if (c.text?.trim()) {
					await api.addPostContent(newId, {
						text: c.text,
						media_ids: c.media_ids || [],
						sequence: c.sequence,
						reply_to_tweet_id: c.reply_to_tweet_id || null,
					});
				}
			}
			navigate(`/posts/${newId}/edit`);
		} catch (err) {
			alert("Failed to duplicate: " + err.message);
		} finally {
			setSaving(false);
		}
	};

	// ── Derived ──────────────────────────────────────────────────────────────
	const postedPlatformKeys = new Set(publishedJobs.map((j) => j.platform_key));
	// A fully-posted post where every enabled platform has been published already
	const allPublished = post?.status === "posted" &&
		KNOWN_PLATFORMS
			.filter((p) => platformStatuses[p.key]?.enabled)
			.every((p) => postedPlatformKeys.has(p.key));
	const isPosted  = post?.status === "posted";
	const charCount = post?.content?.[0]?.text?.length || 0;
	const charCls   = charCount > 280 ? "text-red-400" : charCount > 240 ? "text-amber-400" : "text-zinc-600";

	const actionLabel = { draft: saved ? "Saved!" : saving ? "Saving…" : "Save Draft", now: saving ? "Publishing…" : "Publish Now", fixed: saving ? "Saving…" : "Schedule", random: saving ? "Saving…" : "Schedule" }[scheduleMode];
	const actionIcon  = { draft: saved ? <CheckCircle size={15} /> : <Save size={15} />, now: <Send size={15} />, fixed: <Clock size={15} />, random: <Clock size={15} /> }[scheduleMode];

	// ── Render ───────────────────────────────────────────────────────────────
	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader size={28} className="animate-spin text-amber-400" />
			</div>
		);
	}
	if (!post) return null;

	return (
		<div className="flex h-full">
			{/* ─── Left: Compose ─── */}
			<div className="flex-1 flex flex-col border-r border-[#1e1e1e] min-w-0">
				{/* Breadcrumb */}
				<div className="h-12 flex items-center gap-2 px-6 border-b border-[#1e1e1e] flex-shrink-0">
					<button
						onClick={() => navigate("/posts")}
						className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						<ArrowLeft size={14} />
						Posts
					</button>
					<span className="text-zinc-700 text-xs">/</span>
					<span className="text-sm text-zinc-600">{postId ? "Edit" : "New post"}</span>
					{isPosted && (
						<span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
							Published
						</span>
					)}
				</div>

				{/* Writing area */}
				<div className="flex-1 overflow-y-auto px-8 py-7">
					{/* Title */}
					<input
						type="text"
						value={post.title}
						onChange={(e) => set("title", e.target.value)}
						placeholder="Post title…"
						className="w-full bg-transparent text-xl font-medium text-zinc-100
						           placeholder:text-zinc-700 outline-none border-none mb-6"
					/>

					{/* ── Standalone ── */}
					{post.type === "standalone" && (
						<>
							<textarea
								value={post.content?.[0]?.text || ""}
								onChange={(e) => updateContent(0, { text: e.target.value })}
								placeholder="What do you want to say?"
								rows={14}
							className="w-full bg-[#131313] border border-[#282828] rounded-xl text-sm text-zinc-200 leading-relaxed
							           placeholder:text-zinc-700 outline-none resize-none font-mono p-4
							           focus:border-amber-400/30 focus:ring-1 focus:ring-amber-400/15 transition-all"
							/>
							<div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e1e1e] text-xs">
								<span className="text-zinc-600">{charCount} chars</span>
								<span className={`ml-auto ${charCls}`}>Twitter {charCount}/280</span>
							</div>
						</>
					)}

					{/* ── Thread ── */}
					{post.type === "thread" && (
						<ThreadBuilder
							content={post.content || []}
							onUpdate={(updated) => set("content", updated)}
						/>
					)}

					{/* ── Reply ── */}
					{post.type === "reply" && (
						<div className="space-y-5">
							<div>
								<p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-2">Replying to tweet ID</p>
								<input
									type="text"
									value={post.content?.[0]?.reply_to_tweet_id || ""}
									onChange={(e) => updateContent(0, { reply_to_tweet_id: e.target.value })}
									placeholder="e.g. 1234567890123456789"
									className="input-field font-mono text-sm"
								/>
							</div>
							<textarea
								value={post.content?.[0]?.text || ""}
								onChange={(e) => updateContent(0, { text: e.target.value })}
								placeholder="Write your reply…"
								rows={10}
							className="w-full bg-[#131313] border border-[#282828] rounded-xl text-sm text-zinc-200 leading-relaxed
							           placeholder:text-zinc-700 outline-none resize-none font-mono p-4
							           focus:border-amber-400/30 focus:ring-1 focus:ring-amber-400/15 transition-all"
							/>
							<p className={`text-xs ${charCls}`}>{charCount} / 280</p>
						</div>
					)}

					{/* Attached images */}
					{images.length > 0 && (
						<div className="flex flex-wrap gap-2 mt-6">
							{images.map((img) => (
								<div key={img.id} className="relative group w-20 h-20 rounded-lg overflow-hidden card">
									<SecureImage
										fileId={img.file_id}
										fallbackUrl={img.url}
										alt={img.filename}
										className="w-full h-full object-cover"
									/>
									<button
										type="button"
										onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
										className="absolute inset-0 flex items-center justify-center
										           bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
									>
										<X size={14} className="text-white" />
									</button>
								</div>
							))}
						</div>
					)}

					{/* Inline upload */}
					<div className="mt-5">
						<ImageUpload postId={post.id} onUploaded={handleImagesUploaded} compact />
					</div>
				</div>
			</div>

			{/* ─── Right: Config sidebar ─── */}
			<div className="w-72 flex-shrink-0 sticky top-0 h-screen overflow-y-auto flex flex-col">
				<div className="flex-1 p-5 space-y-7 overflow-y-auto">

					{/* ── Type ── */}
					<section>
						<p className="sidebar-label">Type</p>
						<div className="flex gap-1">
							{[
								{ value: "standalone", label: "Post" },
								{ value: "thread",     label: "Thread" },
								{ value: "reply",      label: "Reply" },
							].map((t) => (
								<button
									key={t.value}
									type="button"
									onClick={() => set("type", t.value)}
									className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
										post.type === t.value
											? "bg-amber-400/15 text-amber-400 border border-amber-400/25"
											: "text-zinc-500 hover:text-zinc-300 bg-[#1c1c1c] border border-[#252525]"
									}`}
								>
									{t.label}
								</button>
							))}
						</div>
					</section>

					{/* ── Platforms ── */}
					<section>
						<p className="sidebar-label">Platforms</p>
						<div className="space-y-0.5">
							{KNOWN_PLATFORMS.map(({ key, label, color, bg }) => {
								const status        = platformStatuses[key];
								const enabled       = status?.enabled;
								const alreadyPosted = postedPlatformKeys.has(key);
								const selected      = selectedPlatforms.includes(key);
								return (
									<div
										key={key}
										onClick={() => !alreadyPosted && togglePlatform(key)}
										className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg select-none transition-colors
											${ enabled && !alreadyPosted ? "cursor-pointer hover:bg-white/[0.04]" : "opacity-40 cursor-not-allowed" }
											${ selected && enabled && !alreadyPosted ? "bg-white/[0.06]" : "" }`}
									>
										<span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
											text-[10px] font-bold transition-colors
											${ alreadyPosted ? "bg-emerald-500 border-emerald-500 text-black" :
											   selected && enabled ? "bg-amber-400 border-amber-400 text-black" : "border-[#333]" }`}
										>
											{alreadyPosted || (selected && enabled) ? "✓" : null}
										</span>
										<span className={`text-xs px-1.5 py-0.5 rounded font-medium ${bg} ${color}`}>{label}</span>
										{alreadyPosted && <span className="ml-auto text-[10px] text-emerald-600">posted</span>}
										{!enabled && !alreadyPosted && <span className="ml-auto text-[10px] text-zinc-700">off — enable in Platforms</span>}
									</div>
								);
							})}
						</div>
					</section>

					{/* ── When ── */}
					<section>
						<p className="sidebar-label">When</p>
						<div className="space-y-0.5">
							{[
								{ id: "draft",  label: "Save as draft" },
								{ id: "now",    label: "Publish now" },
								{ id: "fixed",  label: "Exact time" },
								{ id: "random", label: "Random window" },
							].map((opt) => (
								<label
									key={opt.id}
									className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
										scheduleMode === opt.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
									}`}
								>
									<span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
										scheduleMode === opt.id ? "border-amber-400" : "border-[#444]"
									}`}>
										{scheduleMode === opt.id && <span className="w-2 h-2 rounded-full bg-amber-400" />}
									</span>
									<input type="radio" name="scheduleMode" value={opt.id} checked={scheduleMode === opt.id}
										onChange={() => setScheduleMode(opt.id)} className="sr-only" />
									<span className="text-sm text-zinc-300">{opt.label}</span>
								</label>
							))}
						</div>

						{scheduleMode === "fixed" && (
							<div className="mt-3">
								<input
									type="datetime-local"
									value={scheduledAt}
									onChange={(e) => setScheduledAt(e.target.value)}
									className="input-field text-sm"
								/>
							</div>
						)}
						{scheduleMode === "random" && (
							<div className="mt-3 grid grid-cols-2 gap-2">
								<div>
									<p className="text-[10px] text-zinc-600 mb-1.5">From</p>
									<input type="time" value={windowStart}
										onChange={(e) => setWindowStart(e.target.value)} className="input-field text-sm" />
								</div>
								<div>
									<p className="text-[10px] text-zinc-600 mb-1.5">Until</p>
									<input type="time" value={windowEnd}
										onChange={(e) => setWindowEnd(e.target.value)} className="input-field text-sm" />
								</div>
							</div>
						)}
					</section>

					{/* ── Tags ── */}
					<section>
						<p className="sidebar-label">Tags</p>
						<input
							type="text"
							value={post.metadata?.tags?.join(", ") || ""}
							onChange={(e) => setMeta("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
							placeholder="react, tips, oss…"
							className="input-field text-sm"
						/>
					</section>

					{/* ── Notes (collapsible) ── */}
					<section>
						<button
							type="button"
							onClick={() => setShowNotes(!showNotes)}
							className="sidebar-label flex items-center gap-1.5 hover:text-zinc-400 transition-colors w-full text-left"
						>
							Notes
							<span className="text-zinc-700 text-[9px]">{showNotes ? "▲" : "▼"}</span>
						</button>
						{showNotes && (
							<textarea
								value={post.metadata?.notes || ""}
								onChange={(e) => setMeta("notes", e.target.value)}
								placeholder="Internal notes…"
								rows={3}
								className="input-field text-sm mt-2 resize-none"
							/>
						)}
					</section>
				</div>

				{/* ── Actions ── */}
				<div className="p-4 border-t border-[#1e1e1e] space-y-2 flex-shrink-0">
					{allPublished ? (
						<>
							<p className="text-[11px] text-zinc-600 text-center pb-1">
								This post has already been published.
							</p>
							<button
								type="button"
								onClick={duplicateAsDraft}
								disabled={saving}
								className="btn-primary w-full justify-center"
							>
								{saving ? <Loader size={15} className="animate-spin" /> : <CopyPlus size={15} />}
								Duplicate as Draft
							</button>
							<button
								type="button"
								onClick={() => navigate("/posts")}
								className="btn-ghost w-full justify-center border border-[#252525]"
							>
								Back to Posts
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								onClick={handleAction}
								disabled={saving}
								className="btn-primary w-full justify-center"
							>
								{saving ? <Loader size={15} className="animate-spin" /> : actionIcon}
								{actionLabel}
							</button>
							<button
								type="button"
								onClick={() => navigate("/posts")}
								className="btn-ghost w-full justify-center border border-[#252525]"
							>
								Cancel
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
