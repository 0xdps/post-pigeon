import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, Loader, Send, Clock, ArrowLeft, CopyPlus, Trash2 } from "lucide-react";
import { api } from "../api.js";
import ImageUpload from "../components/ImageUpload.jsx";
import ThreadBuilder from "../components/ThreadBuilder.jsx";
import { SecureImage } from "../components/SecureImage.jsx";
import { fileManager } from "../fileManager.js";

// Platform definitions (mirrors server catalog — avoids a round-trip for the static list)
const KNOWN_PLATFORMS = [
	{ key: "twitter",  label: "X / Twitter", color: "text-blue-300",    bg: "bg-blue-400/10",    charLimit: 280    },
	{ key: "threads",  label: "Threads",      color: "text-violet-300", bg: "bg-violet-400/10",  charLimit: 500    },
	{ key: "linkedin", label: "LinkedIn",     color: "text-sky-300",    bg: "bg-sky-400/10",     charLimit: 3000   },
	{ key: "reddit",   label: "Reddit",       color: "text-orange-300", bg: "bg-orange-400/10",  charLimit: 40000  },
	{ key: "devto",    label: "Dev.to",       color: "text-zinc-300",   bg: "bg-zinc-700/40",    charLimit: 100000 },
	{ key: "bluesky",  label: "Bluesky",      color: "text-cyan-300",   bg: "bg-cyan-400/10",    charLimit: 300    },
];

const BLANK_CONTENT = () => [{ id: "content-1", text: "", media_ids: [], sequence: 1 }];

// DB-persisted content IDs have format: content-{timestamp}-{random} (3 dash-separated parts after "content")
const isDbContentId = (id) => id && id.startsWith("content-") && id.split("-").length === 3;

export default function PostEditor() {
	const { id: postId } = useParams();
	const navigate = useNavigate();

	const [post, setPost]         = useState(null);
	const [loading, setLoading]   = useState(true);
	const [images, setImages]     = useState([]);
	const [publishing, setPublishing] = useState(false);
	const [discarding, setDiscarding] = useState(false);

	// Autosave status: idle | pending | saving | saved | error
	const [autoSaveStatus, setAutoSaveStatus] = useState("idle");

	// Platform states
	const [platformStatuses, setPlatformStatuses]   = useState({});
	const [selectedPlatforms, setSelectedPlatforms] = useState(["twitter"]);
	const [publishedJobs, setPublishedJobs]         = useState([]);

	// Schedule
	const [scheduleMode, setScheduleMode] = useState("now"); // now | fixed | random
	const [scheduledAt, setScheduledAt]   = useState("");
	const [windowStart, setWindowStart]   = useState("09:00");
	const [windowEnd, setWindowEnd]       = useState("21:00");
	const [replyParsed, setReplyParsed]   = useState(null);
	const [showNotes, setShowNotes]       = useState(false);

	// Refs for autosave — keeps callbacks stable, avoids stale closures
	const saveTimerRef    = useRef(null);
	const postRef         = useRef(null);
	const postIdRef       = useRef(postId);
	// Maps local temp IDs → DB-assigned content IDs so we update (not re-create) on next save
	const contentIdMapRef = useRef({});

	useEffect(() => { postRef.current = post; }, [post]);
	useEffect(() => { postIdRef.current = postId; }, [postId]);

	// ── Init ─────────────────────────────────────────────────────────────────
	useEffect(() => {
		loadPlatforms();
		if (postId) {
			loadPost();
		} else {
			// Create a draft in the DB immediately so image upload works from the first keystroke
			createNewDraft();
		}
	}, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

	const createNewDraft = async () => {
		const newId = `post-${Date.now()}`;
		try {
			await api.createPost({ id: newId, type: "standalone", title: "Untitled", metadata: {} });
			// Replace history entry so pressing Back doesn't loop back to /posts/new
			navigate(`/posts/${newId}`, { replace: true });
		} catch (err) {
			console.error("Failed to create draft:", err);
			setLoading(false);
		}
	};

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
		setLoading(true);
		try {
			const result = await api.getPost(postId);
			if (!result?.success) return;

			const raw = result.post.content || [];
			// If the post has no content yet (fresh draft), seed a blank content item
			const contentWithText = raw.length > 0
				? await Promise.all(raw.map(async (c) => {
					if (c.text_file_id) {
						const text = (await fileManager.getFileText(c.text_file_id))
							?? (await api.getFileText(c.text_file_id));
						return { ...c, text: text || "" };
					}
					return c;
				  }))
				: BLANK_CONTENT();

			setPost({ ...result.post, content: contentWithText });

			const imgResult = await api.listPostImages(postId);
			if (imgResult?.success) setImages(imgResult.images || []);

			const jobsResult = await api.listPublishJobs({ post_id: postId });
			const posted = (jobsResult?.jobs || []).filter((j) => j.status === "posted");
			setPublishedJobs(posted);
			const postedKeys = new Set(posted.map((j) => j.platform_key));
			setSelectedPlatforms((prev) => prev.filter((k) => !postedKeys.has(k)));
		} catch (err) {
			console.error("Failed to load post:", err);
		} finally {
			setLoading(false);
		}
	};

	// ── Autosave ─────────────────────────────────────────────────────────────
	// Stable callback (empty deps) — reads current values via refs to avoid stale closures.
	// Content IDs are tracked in contentIdMapRef so we UPDATE on subsequent saves
	// instead of creating duplicate DB rows.
	const performSave = useCallback(async () => {
		const p  = postRef.current;
		const id = postIdRef.current;
		if (!p || !id || p.status === "posted") return;

		setAutoSaveStatus("saving");
		try {
			await api.updatePost(id, {
				title:    p.title?.trim() || "Untitled",
				type:     p.type,
				metadata: p.metadata,
			});

			const idMap = contentIdMapRef.current;
			for (const c of p.content || []) {
				if (!c.text?.trim()) continue;

				// Resolve: use tracked DB ID for temp IDs, or use the ID directly if it's already a DB ID
				const dbId = idMap[c.id] || (isDbContentId(c.id) ? c.id : null);

				if (dbId) {
					await api.updatePostContent(id, dbId, {
						text:              c.text,
						media_ids:         c.media_ids || [],
						sequence:          c.sequence,
						reply_to_tweet_id: c.reply_to_tweet_id || null,
					});
				} else {
					const res = await api.addPostContent(id, {
						text:              c.text,
						media_ids:         c.media_ids || [],
						sequence:          c.sequence,
						reply_to_tweet_id: c.reply_to_tweet_id || null,
					});
					// Record the DB ID so subsequent saves update instead of re-insert
					if (res?.contentId) {
						contentIdMapRef.current = { ...idMap, [c.id]: res.contentId };
					}
				}
			}

			setAutoSaveStatus("saved");
			setTimeout(() => setAutoSaveStatus("idle"), 2500);
		} catch (err) {
			console.error("Autosave failed:", err);
			setAutoSaveStatus("error");
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Debounce: reset 1.5 s timer on every content/title/metadata change
	useEffect(() => {
		if (!post || !postId) return;
		setAutoSaveStatus("pending");
		clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(performSave, 1500);
		return () => clearTimeout(saveTimerRef.current);
	}, [post?.title, post?.type, post?.content, post?.metadata]); // eslint-disable-line react-hooks/exhaustive-deps

	// Flush debounce and save immediately (called before publish/schedule)
	const saveNow = useCallback(async () => {
		clearTimeout(saveTimerRef.current);
		await performSave();
	}, [performSave]);

	// ── Updaters ─────────────────────────────────────────────────────────────
	const set     = (key, val) => setPost((p) => ({ ...p, [key]: val }));
	const setMeta = (key, val) => setPost((p) => ({ ...p, metadata: { ...p.metadata, [key]: val } }));
	const setPlatformField = (pkey, field, val) =>
		setPost((p) => ({
			...p,
			metadata: {
				...p.metadata,
				platforms: {
					...(p.metadata?.platforms || {}),
					[pkey]: { ...(p.metadata?.platforms?.[pkey] || {}), [field]: val },
				},
			},
		}));
	const getPF = (pkey, field, def = "") => post?.metadata?.platforms?.[pkey]?.[field] ?? def;

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

	// ── Publish / Schedule ───────────────────────────────────────────────────
	const handlePublish = async () => {
		if (selectedPlatforms.length === 0) { alert("Select at least one platform."); return; }
		if (scheduleMode === "fixed" && !scheduledAt) { alert("Pick a date and time."); return; }

		setPublishing(true);
		try {
			await saveNow();

			const platforms = selectedPlatforms.map((key) => {
				if (scheduleMode === "fixed")  return { key, mode: "fixed",  scheduled_at: new Date(scheduledAt).getTime() };
				if (scheduleMode === "random") return { key, mode: "random", window_start: windowStart, window_end: windowEnd };
				return { key, mode: "fixed", scheduled_at: Date.now() + 3000 };
			});

			const result = await api.createSchedule({ post_id: postId, platforms });

			if (scheduleMode === "now") {
				for (const job of result?.jobs || []) {
					await api.publishJob(job.job_id);
				}
			}
			navigate("/queue");
		} catch (err) {
			alert("Failed: " + err.message);
		} finally {
			setPublishing(false);
		}
	};

	// ── Discard ──────────────────────────────────────────────────────────────
	const handleDiscard = async () => {
		if (!confirm("Delete this draft? This cannot be undone.")) return;
		setDiscarding(true);
		try {
			await api.deletePost(postId);
			navigate("/posts");
		} catch (err) {
			alert("Failed to delete: " + err.message);
			setDiscarding(false);
		}
	};

	// ── Duplicate ────────────────────────────────────────────────────────────
	const duplicateAsDraft = async () => {
		setPublishing(true);
		try {
			const newId = `post-${Date.now()}`;
			await api.createPost({
				id:       newId,
				type:     post.type,
				title:    `${post.title} (copy)`,
				metadata: { ...post.metadata },
			});
			for (const c of post.content || []) {
				if (c.text?.trim()) {
					await api.addPostContent(newId, {
						text:              c.text,
						media_ids:         c.media_ids || [],
						sequence:          c.sequence,
						reply_to_tweet_id: c.reply_to_tweet_id || null,
					});
				}
			}
			navigate(`/posts/${newId}`);
		} catch (err) {
			alert("Failed to duplicate: " + err.message);
		} finally {
			setPublishing(false);
		}
	};

	// ── Derived ──────────────────────────────────────────────────────────────
	const postedPlatformKeys = new Set(publishedJobs.map((j) => j.platform_key));
	const allPublished = post?.status === "posted" &&
		KNOWN_PLATFORMS
			.filter((p) => platformStatuses[p.key]?.enabled)
			.every((p) => postedPlatformKeys.has(p.key));
	const isPosted = post?.status === "posted";

	const charCount = post?.content?.[0]?.text?.length || 0;
	const tightestLimit = selectedPlatforms.length > 0
		? Math.min(...selectedPlatforms.map((k) => KNOWN_PLATFORMS.find((p) => p.key === k)?.charLimit ?? Infinity))
		: null;
	const charCls = tightestLimit
		? (charCount > tightestLimit ? "text-red-400" : charCount > tightestLimit * 0.85 ? "text-sky-500" : "text-zinc-600")
		: "text-zinc-600";

	const displayTitle = post?.title && post.title !== "Untitled" ? post.title : "New post";

	const publishLabel = {
		now:    publishing ? "Publishing…"    : "Publish Now",
		fixed:  publishing ? "Scheduling…"    : "Schedule",
		random: publishing ? "Scheduling…"    : "Schedule (random)",
	}[scheduleMode];
	const publishIcon = {
		now:    <Send size={15} />,
		fixed:  <Clock size={15} />,
		random: <Clock size={15} />,
	}[scheduleMode];

	// ── Render ───────────────────────────────────────────────────────────────
	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader size={28} className="animate-spin text-sky-500" />
			</div>
		);
	}
	if (!post) return null;

	return (
		<div className="flex h-full">
			{/* ─── Left: Compose ─── */}
			<div className="flex-1 flex flex-col border-r border-[#1e1e1e] min-w-0">

				{/* Header bar */}
				<div className="h-12 flex items-center gap-2 px-6 border-b border-[#1e1e1e] flex-shrink-0">
					<button
						onClick={() => navigate("/posts")}
						className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						<ArrowLeft size={14} />
						Library
					</button>
					<span className="text-zinc-700 text-xs">/</span>
					<span className="text-sm text-zinc-600 truncate max-w-xs">{displayTitle}</span>
					{isPosted && (
						<span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium shrink-0">
							Published
						</span>
					)}
					{/* Autosave indicator */}
					<div className="ml-auto flex items-center gap-2 shrink-0">
						{autoSaveStatus === "pending" && (
							<span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-pulse" title="Unsaved changes" />
						)}
						{autoSaveStatus === "saving" && (
							<span className="text-[11px] text-zinc-600">Saving…</span>
						)}
						{autoSaveStatus === "saved" && (
							<span className="text-[11px] text-emerald-600">Saved</span>
						)}
						{autoSaveStatus === "error" && (
							<span className="text-[11px] text-red-500">Save failed</span>
						)}
					</div>
				</div>

				{/* Writing area */}
				<div className="flex-1 overflow-y-auto px-8 py-7">

					{/* Internal label */}
					<input
						type="text"
						value={post.title === "Untitled" ? "" : post.title}
						onChange={(e) => set("title", e.target.value || "Untitled")}
						placeholder="Add a label (internal, not posted)"
						className="w-full bg-transparent text-xl font-medium text-zinc-100
						           placeholder:text-zinc-700 outline-none border-none mb-5"
					/>

					{/* Post type tabs — visible next to the content, not buried in the sidebar */}
					<div className="flex gap-1 mb-5">
						{[
							{ value: "standalone", label: "Post" },
							{ value: "thread",     label: "Thread" },
							{ value: "reply",      label: "Reply" },
						].map((t) => (
							<button
								key={t.value}
								type="button"
								onClick={() => set("type", t.value)}
								className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
									post.type === t.value
										? "bg-sky-500/15 text-sky-400 border border-sky-500/25"
										: "text-zinc-500 hover:text-zinc-300 bg-[#1c1c1c] border border-[#252525]"
								}`}
							>
								{t.label}
							</button>
						))}
					</div>

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
								           focus:border-sky-500/30 focus:ring-1 focus:ring-sky-500/15 transition-all"
							/>
							<div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e1e1e] text-xs">
								<button
									type="button"
									onClick={() => {
										set("type", "thread");
										set("content", [
											...(post.content || []),
											{ id: `content-${Date.now()}`, text: "", media_ids: [], sequence: (post.content?.length || 1) + 1 },
										]);
									}}
									className="text-zinc-600 hover:text-sky-500 transition-colors"
								>
									+ Continue as thread
								</button>
								{tightestLimit ? (
									<span className={`ml-auto ${charCls}`}>{charCount} / {tightestLimit}</span>
								) : (
									<span className="ml-auto text-zinc-600">{charCount} chars</span>
								)}
							</div>
						</>
					)}

					{/* ── Thread ── */}
					{post.type === "thread" && (
						<ThreadBuilder
							content={post.content || []}
							onUpdate={(updated) => set("content", updated)}
							charLimit={tightestLimit || 280}
						/>
					)}

					{/* ── Reply ── */}
					{post.type === "reply" && (
						<div className="space-y-5">
							<div>
								<p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-2">Reply to tweet</p>
								<input
									type="text"
									value={post.content?.[0]?.reply_to_tweet_id || ""}
									onChange={(e) => {
										const val = e.target.value;
										const match = val.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/);
										if (match) {
											updateContent(0, { reply_to_tweet_id: match[2] });
											setReplyParsed({ id: match[2], username: match[1] });
										} else {
											updateContent(0, { reply_to_tweet_id: val });
											setReplyParsed(null);
										}
									}}
									placeholder="Paste tweet URL or ID"
									className="input-field text-sm"
								/>
								{replyParsed && (
									<p className="text-xs text-emerald-400 mt-1.5">Replying to @{replyParsed.username}</p>
								)}
							</div>
							<textarea
								value={post.content?.[0]?.text || ""}
								onChange={(e) => updateContent(0, { text: e.target.value })}
								placeholder="Write your reply…"
								rows={10}
								className="w-full bg-[#131313] border border-[#282828] rounded-xl text-sm text-zinc-200 leading-relaxed
								           placeholder:text-zinc-700 outline-none resize-none font-mono p-4
								           focus:border-sky-500/30 focus:ring-1 focus:ring-sky-500/15 transition-all"
							/>
							<p className={`text-xs ${charCls}`}>
								{tightestLimit ? `${charCount} / ${tightestLimit}` : `${charCount} chars`}
							</p>
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
										onClick={async () => {
											try {
												await api.deletePostImage(postId, img.id);
												setImages((prev) => prev.filter((i) => i.id !== img.id));
											} catch { /* silent */ }
										}}
										className="absolute inset-0 flex items-center justify-center
										           bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
									>
										<X size={14} className="text-white" />
									</button>
								</div>
							))}
						</div>
					)}

					{/* Image upload — always available since the post is already persisted */}
					<div className="mt-5">
						<ImageUpload
							postId={postId}
							onUploaded={(uploaded) => setImages((prev) => [...prev, ...uploaded])}
							compact
						/>
					</div>
				</div>
			</div>

			{/* ─── Right: Publish sidebar ─── */}
			<div className="w-72 flex-shrink-0 sticky top-0 h-screen overflow-y-auto flex flex-col">
				<div className="flex-1 p-5 space-y-7 overflow-y-auto">

					{/* ── Platforms ── */}
					<section>
						<p className="sidebar-label">Platforms</p>
						<div className="space-y-1">
							{KNOWN_PLATFORMS.map(({ key, label, color, bg }) => {
								const status        = platformStatuses[key];
								const enabled       = status?.enabled;
								const alreadyPosted = postedPlatformKeys.has(key);
								const selected      = selectedPlatforms.includes(key);
								const showFields    = selected && enabled && !alreadyPosted;
								return (
									<div key={key}>
										{/* Platform row */}
										<div
											onClick={() => !alreadyPosted && togglePlatform(key)}
											className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg select-none transition-colors
												${ enabled && !alreadyPosted ? "cursor-pointer hover:bg-white/[0.04]" : "opacity-40 cursor-not-allowed" }
												${ showFields ? "bg-white/[0.06]" : "" }`}
										>
											<span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
												text-[10px] font-bold transition-colors
												${ alreadyPosted ? "bg-emerald-500 border-emerald-500 text-black" :
												   selected && enabled ? "bg-sky-500 border-sky-500 text-black" : "border-[#333]" }`}
											>
												{alreadyPosted || (selected && enabled) ? "✓" : null}
											</span>
											<span className={`text-xs px-1.5 py-0.5 rounded font-medium ${bg} ${color}`}>{label}</span>
											{alreadyPosted && <span className="ml-auto text-[10px] text-emerald-600">posted</span>}
											{!enabled && !alreadyPosted && <span className="ml-auto text-[10px] text-zinc-700">off</span>}
										</div>

										{/* Per-platform fields — shown when selected */}
										{showFields && (
											<div className="ml-[26px] p-3 rounded-lg bg-[#141414] border border-[#222] space-y-3">
												{/* ── Reddit ── */}
												{key === "reddit" && (<>
													<div>
														<p className="platform-field-label">Subreddit <span className="text-red-500">*</span></p>
														<div className="flex items-center">
															<span className="text-xs text-zinc-500 mr-1">r/</span>
															<input type="text" placeholder="programming" className="input-field text-xs flex-1"
																value={getPF("reddit", "subreddit")}
																onChange={(e) => setPlatformField("reddit", "subreddit", e.target.value)} />
														</div>
													</div>
													<div>
														<p className="platform-field-label">Reddit title <span className="text-red-500">*</span></p>
														<p className="text-[10px] text-zinc-600 mb-1.5">Shown as the post headline on Reddit</p>
														<input type="text" placeholder="Give it a punchy title…" className="input-field text-xs"
															value={getPF("reddit", "title")}
															onChange={(e) => setPlatformField("reddit", "title", e.target.value)} />
													</div>
													<div>
														<p className="platform-field-label">Flair</p>
														<input type="text" placeholder="e.g. Discussion" className="input-field text-xs"
															value={getPF("reddit", "flair")}
															onChange={(e) => setPlatformField("reddit", "flair", e.target.value)} />
													</div>
												</>)}

												{/* ── Dev.to ── */}
												{key === "devto" && (<>
													<div>
														<p className="platform-field-label">Dev.to tags</p>
														<p className="text-[10px] text-zinc-600 mb-1.5">Up to 4, comma-separated (their tag system)</p>
														<input type="text" placeholder="javascript, webdev, react" className="input-field text-xs"
															value={getPF("devto", "tags")}
															onChange={(e) => setPlatformField("devto", "tags", e.target.value)} />
													</div>
													<div>
														<p className="platform-field-label">Series</p>
														<p className="text-[10px] text-zinc-600 mb-1.5">Groups this into a series on your profile</p>
														<input type="text" placeholder="e.g. Building in Public" className="input-field text-xs"
															value={getPF("devto", "series")}
															onChange={(e) => setPlatformField("devto", "series", e.target.value)} />
													</div>
													<div>
														<p className="platform-field-label">Canonical URL</p>
														<p className="text-[10px] text-zinc-600 mb-1.5">If this post originally lives elsewhere</p>
														<input type="url" placeholder="https://yourblog.com/post" className="input-field text-xs"
															value={getPF("devto", "canonicalUrl")}
															onChange={(e) => setPlatformField("devto", "canonicalUrl", e.target.value)} />
													</div>
												</>)}

												{/* ── LinkedIn ── */}
												{key === "linkedin" && (
													<div>
														<p className="platform-field-label">Visibility</p>
														<p className="text-[10px] text-zinc-600 mb-1.5">Who can see this post on LinkedIn</p>
														<div className="flex gap-1.5">
															{[["public", "Everyone"], ["connections", "Connections only"]].map(([val, lbl]) => (
																<button key={val} type="button"
																	onClick={() => setPlatformField("linkedin", "visibility", val)}
																	className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
																		getPF("linkedin", "visibility", "public") === val
																			? "bg-sky-500/15 text-sky-400 border-sky-500/30"
																			: "bg-transparent text-zinc-500 border-[#2a2a2a] hover:border-[#444]"
																	}`}>
																	{lbl}
																</button>
															))}
														</div>
													</div>
												)}

												{/* ── Bluesky ── */}
												{key === "bluesky" && (
													<div>
														<p className="platform-field-label">Language</p>
														<p className="text-[10px] text-zinc-600 mb-1.5">Helps Bluesky surface your post to the right audience</p>
														<input type="text" placeholder="en" maxLength={5} className="input-field text-xs"
															value={getPF("bluesky", "language", "en")}
															onChange={(e) => setPlatformField("bluesky", "language", e.target.value)} />
													</div>
												)}

												{/* Twitter, Threads — no extra fields needed */}
												{(key === "twitter" || key === "threads") && (
													<p className="text-[11px] text-zinc-600">No extra settings needed for {label}.</p>
												)}
											</div>
										)}
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
								{ id: "now",    label: "Publish now" },
								{ id: "fixed",  label: "Exact time" },
								{ id: "random", label: "Within active hours" },
							].map((opt) => (
								<label
									key={opt.id}
									className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
										scheduleMode === opt.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
									}`}
								>
									<span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
										scheduleMode === opt.id ? "border-sky-500" : "border-[#444]"
									}`}>
										{scheduleMode === opt.id && <span className="w-2 h-2 rounded-full bg-sky-500" />}
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
								Already published everywhere.
							</p>
							<button
								type="button"
								onClick={duplicateAsDraft}
								disabled={publishing}
								className="btn-primary w-full justify-center"
							>
								{publishing ? <Loader size={15} className="animate-spin" /> : <CopyPlus size={15} />}
								Duplicate as Draft
							</button>
							<button
								type="button"
								onClick={() => navigate("/posts")}
								className="btn-ghost w-full justify-center border border-[#252525]"
							>
								Back to Library
							</button>
						</>
					) : isPosted ? (
						<>
							<button
								type="button"
								onClick={duplicateAsDraft}
								disabled={publishing}
								className="btn-primary w-full justify-center"
							>
								{publishing ? <Loader size={15} className="animate-spin" /> : <CopyPlus size={15} />}
								Duplicate as Draft
							</button>
							<button
								type="button"
								onClick={() => navigate("/posts")}
								className="btn-ghost w-full justify-center border border-[#252525]"
							>
								Back to Library
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								onClick={handlePublish}
								disabled={publishing || discarding}
								className="btn-primary w-full justify-center"
							>
								{publishing ? <Loader size={15} className="animate-spin" /> : publishIcon}
								{publishLabel}
							</button>
							<button
								type="button"
								onClick={handleDiscard}
								disabled={publishing || discarding}
								className="btn-ghost w-full justify-center border border-[#252525] hover:border-red-800/60 hover:text-red-400 transition-colors"
							>
								{discarding ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
								Discard draft
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
