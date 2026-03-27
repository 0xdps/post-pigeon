import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, Loader, Send, Clock, ArrowLeft, CopyPlus, Trash2, Shuffle } from "lucide-react";
import { api } from "../api.js";
import ImageUpload from "../components/ImageUpload.jsx";
import ThreadBuilder from "../components/ThreadBuilder.jsx";
import { SecureImage } from "../components/SecureImage.jsx";
import { fileManager } from "../fileManager.js";

/* ── Constants ───────────────────────────────────────────────────────────── */

const KNOWN_PLATFORMS = [
	{ key: "twitter",  label: "X / Twitter", color: "#60a5fa", charLimit: 280    },
	{ key: "threads",  label: "Threads",      color: "#a78bfa", charLimit: 500    },
	{ key: "linkedin", label: "LinkedIn",     color: "#38bdf8", charLimit: 3000   },
	{ key: "reddit",   label: "Reddit",       color: "#fb923c", charLimit: 40000  },
	{ key: "devto",    label: "Dev.to",       color: "#a3e635", charLimit: 100000 },
	{ key: "bluesky",  label: "Bluesky",      color: "#67e8f9", charLimit: 300    },
];

const BLANK_CONTENT = () => [{ id: "content-1", text: "", media_ids: [], sequence: 1 }];
const isDbContentId = (id) => id && id.startsWith("content-") && id.split("-").length === 3;

/* ── Component ───────────────────────────────────────────────────────────── */

export default function PostEditor() {
	const { id: postId } = useParams();
	const navigate = useNavigate();

	const [post, setPost]             = useState(null);
	const [loading, setLoading]       = useState(true);
	const [images, setImages]         = useState([]);
	const [publishing, setPublishing] = useState(false);
	const [discarding, setDiscarding] = useState(false);
	const [autoSaveStatus, setAutoSaveStatus] = useState("idle");

	const [platformStatuses, setPlatformStatuses]   = useState({});
	const [selectedPlatforms, setSelectedPlatforms] = useState(["twitter"]);
	const [publishedJobs, setPublishedJobs]         = useState([]);

	const [scheduleMode, setScheduleMode] = useState("now");
	const [scheduledAt, setScheduledAt]   = useState("");
	const [windowStart, setWindowStart]   = useState("09:00");
	const [windowEnd, setWindowEnd]       = useState("21:00");
	const [replyParsed, setReplyParsed]   = useState(null);
	const [showNotes, setShowNotes]       = useState(false);

	const saveTimerRef    = useRef(null);
	const postRef         = useRef(null);
	const postIdRef       = useRef(postId);
	const contentIdMapRef = useRef({});

	useEffect(() => { postRef.current = post; }, [post]);
	useEffect(() => { postIdRef.current = postId; }, [postId]);

	useEffect(() => {
		loadPlatforms();
		if (postId) loadPost();
		else createNewDraft();
	}, [postId]); // eslint-disable-line

	const createNewDraft = async () => {
		const newId = `post-${Date.now()}`;
		try {
			await api.createPost({ id: newId, type: "standalone", title: "Untitled", metadata: {} });
			navigate(`/posts/${newId}`, { replace: true });
		} catch {
			setLoading(false);
		}
	};

	const loadPlatforms = async () => {
		try {
			const result = await api.getPlatforms();
			const map = {};
			for (const p of result?.platforms || []) map[p.key] = { enabled: !!p.enabled, auth_status: p.auth_status };
			setPlatformStatuses(map);
		} catch { /* silent */ }
	};

	const loadPost = async () => {
		setLoading(true);
		try {
			const result = await api.getPost(postId);
			if (!result?.success) return;
			const raw = result.post.content || [];
			const contentWithText = raw.length > 0
				? await Promise.all(raw.map(async (c) => {
					if (c.text_file_id) {
						const text = (await fileManager.getFileText(c.text_file_id)) ?? (await api.getFileText(c.text_file_id));
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

	const performSave = useCallback(async () => {
		const p  = postRef.current;
		const id = postIdRef.current;
		if (!p || !id || p.status === "posted") return;
		setAutoSaveStatus("saving");
		try {
			await api.updatePost(id, { title: p.title?.trim() || "Untitled", type: p.type, metadata: p.metadata });
			const idMap = contentIdMapRef.current;
			for (const c of p.content || []) {
				if (!c.text?.trim()) continue;
				const dbId = idMap[c.id] || (isDbContentId(c.id) ? c.id : null);
				if (dbId) {
					await api.updatePostContent(id, dbId, { text: c.text, media_ids: c.media_ids || [], sequence: c.sequence, reply_to_tweet_id: c.reply_to_tweet_id || null });
				} else {
					const res = await api.addPostContent(id, { text: c.text, media_ids: c.media_ids || [], sequence: c.sequence, reply_to_tweet_id: c.reply_to_tweet_id || null });
					if (res?.contentId) contentIdMapRef.current = { ...idMap, [c.id]: res.contentId };
				}
			}
			setAutoSaveStatus("saved");
			setTimeout(() => setAutoSaveStatus("idle"), 2500);
		} catch {
			setAutoSaveStatus("error");
		}
	}, []);

	useEffect(() => {
		if (!post || !postId) return;
		setAutoSaveStatus("pending");
		clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(performSave, 1500);
		return () => clearTimeout(saveTimerRef.current);
	}, [post?.title, post?.type, post?.content, post?.metadata]); // eslint-disable-line

	const saveNow = useCallback(async () => {
		clearTimeout(saveTimerRef.current);
		await performSave();
	}, [performSave]);

	const set     = (key, val) => setPost((p) => ({ ...p, [key]: val }));
	const setMeta = (key, val) => setPost((p) => ({ ...p, metadata: { ...p.metadata, [key]: val } }));
	const setPlatformField = (pkey, field, val) =>
		setPost((p) => ({ ...p, metadata: { ...p.metadata, platforms: { ...(p.metadata?.platforms || {}), [pkey]: { ...(p.metadata?.platforms?.[pkey] || {}), [field]: val } } } }));
	const getPF = (pkey, field, def = "") => post?.metadata?.platforms?.[pkey]?.[field] ?? def;

	const updateContent = (index, updates) => {
		const updated = [...(post.content || [])];
		updated[index] = { ...updated[index], ...updates };
		set("content", updated);
	};

	const togglePlatform = (key) => {
		if (!platformStatuses[key]?.enabled) return;
		setSelectedPlatforms((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
	};

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
				for (const job of result?.jobs || []) await api.publishJob(job.job_id);
			}
			navigate("/queue");
		} catch (err) {
			alert("Failed: " + err.message);
		} finally {
			setPublishing(false);
		}
	};

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

	const duplicateAsDraft = async () => {
		setPublishing(true);
		try {
			const newId = `post-${Date.now()}`;
			await api.createPost({ id: newId, type: post.type, title: `${post.title} (copy)`, metadata: { ...post.metadata } });
			for (const c of post.content || []) {
				if (c.text?.trim()) await api.addPostContent(newId, { text: c.text, media_ids: c.media_ids || [], sequence: c.sequence, reply_to_tweet_id: c.reply_to_tweet_id || null });
			}
			navigate(`/posts/${newId}`);
		} catch (err) {
			alert("Failed to duplicate: " + err.message);
		} finally {
			setPublishing(false);
		}
	};

	// Derived
	const postedPlatformKeys = new Set(publishedJobs.map((j) => j.platform_key));
	const allPublished = post?.status === "posted" && KNOWN_PLATFORMS.filter((p) => platformStatuses[p.key]?.enabled).every((p) => postedPlatformKeys.has(p.key));
	const isPosted     = post?.status === "posted";
	const charCount    = post?.content?.[0]?.text?.length || 0;
	const tightestLimit = selectedPlatforms.length > 0
		? Math.min(...selectedPlatforms.map((k) => KNOWN_PLATFORMS.find((p) => p.key === k)?.charLimit ?? Infinity))
		: null;
	const charOver = tightestLimit && charCount > tightestLimit;
	const charWarn = tightestLimit && !charOver && charCount > tightestLimit * 0.85;
	const displayTitle = post?.title && post.title !== "Untitled" ? post.title : "Untitled";

	const publishLabel = { now: publishing ? "Publishing…" : "Publish Now", fixed: publishing ? "Scheduling…" : "Schedule", random: publishing ? "Scheduling…" : "Schedule in window" }[scheduleMode];
	const publishIcon  = { now: <Send size={14} />, fixed: <Clock size={14} />, random: <Shuffle size={14} /> }[scheduleMode];

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64 gap-2 text-sm" style={{ color: "var(--text-2)" }}>
				<Loader size={16} className="animate-spin" style={{ color: "var(--accent)" }} /> Loading post…
			</div>
		);
	}
	if (!post) return null;

	return (
		<div className="flex h-full" style={{ background: "var(--bg)" }}>

			{/* ─── Left: Compose area ─── */}
			<div className="flex-1 flex flex-col min-w-0" style={{ borderRight: "1px solid var(--border)" }}>

				{/* Top bar */}
				<div
					className="h-12 flex items-center gap-3 px-5 flex-shrink-0"
					style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}
				>
					<button
						onClick={() => navigate("/posts")}
						className="flex items-center gap-1.5 text-sm transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-2)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}
					>
						<ArrowLeft size={13} /> Library
					</button>
					<span style={{ color: "var(--border-2)" }}>/</span>
					<span className="text-sm truncate max-w-xs" style={{ color: "var(--text-2)" }}>{displayTitle}</span>

					{isPosted && (
						<span className="badge badge-posted shrink-0">Published</span>
					)}

					{/* Autosave */}
					<div className="ml-auto flex items-center gap-2 shrink-0">
						{autoSaveStatus === "pending" && (
							<span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--amber)", opacity: 0.7 }} />
						)}
						{autoSaveStatus === "saving" && (
							<span className="text-[11px] font-mono" style={{ color: "var(--text-3)" }}>saving…</span>
						)}
						{autoSaveStatus === "saved" && (
							<span className="text-[11px] font-mono" style={{ color: "var(--green)" }}>saved</span>
						)}
						{autoSaveStatus === "error" && (
							<span className="text-[11px] font-mono" style={{ color: "var(--red)" }}>save failed</span>
						)}
					</div>
				</div>

				{/* Writing area */}
				<div className="flex-1 overflow-y-auto px-8 py-7">

					{/* Internal label / title */}
					<input
						type="text"
						value={post.title === "Untitled" ? "" : post.title}
						onChange={(e) => set("title", e.target.value || "Untitled")}
						placeholder="Add a label (internal)"
						className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none border-none mb-5"
						style={{ color: "var(--text)", caretColor: "var(--accent)" }}
					/>

					{/* Post type tabs */}
					<div className="flex gap-1.5 mb-6">
						{[
							{ value: "standalone", label: "Post" },
							{ value: "thread",     label: "Thread" },
							{ value: "reply",      label: "Reply" },
						].map((t) => (
							<button
								key={t.value}
								type="button"
								onClick={() => set("type", t.value)}
								className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
								style={{
									background: post.type === t.value ? "var(--accent-dim2)" : "transparent",
									color:      post.type === t.value ? "var(--accent)" : "var(--text-3)",
									border:     `1px solid ${post.type === t.value ? "rgba(168,230,61,0.3)" : "var(--border-2)"}`,
								}}
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
								className="textarea-field"
								style={{ width: "100%" }}
							/>
							<div className="flex items-center gap-3 mt-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--border)" }}>
								<button
									type="button"
									onClick={() => {
										set("type", "thread");
										set("content", [...(post.content || []), { id: `content-${Date.now()}`, text: "", media_ids: [], sequence: (post.content?.length || 1) + 1 }]);
									}}
									className="transition-colors"
									style={{ color: "var(--text-3)" }}
									onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
									onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}
								>
									+ Continue as thread
								</button>
								<span
									className="ml-auto font-mono"
									style={{
										color: charOver ? "var(--red)" : charWarn ? "var(--amber)" : "var(--text-3)",
									}}
								>
									{charCount}{tightestLimit ? ` / ${tightestLimit}` : ""}
								</span>
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
								<p className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--text-3)" }}>
									Reply to tweet URL or ID
								</p>
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
									placeholder="https://x.com/user/status/…"
									className="input-field"
								/>
								{replyParsed && (
									<p className="text-xs mt-1.5" style={{ color: "var(--green)" }}>
										Replying to @{replyParsed.username}
									</p>
								)}
							</div>
							<textarea
								value={post.content?.[0]?.text || ""}
								onChange={(e) => updateContent(0, { text: e.target.value })}
								placeholder="Write your reply…"
								rows={10}
								className="textarea-field"
								style={{ width: "100%" }}
							/>
							<p className="text-xs font-mono" style={{ color: charOver ? "var(--red)" : charWarn ? "var(--amber)" : "var(--text-3)" }}>
								{charCount}{tightestLimit ? ` / ${tightestLimit}` : ""}
							</p>
						</div>
					)}

					{/* Attached images */}
					{images.length > 0 && (
						<div className="flex flex-wrap gap-2 mt-6">
							{images.map((img) => (
								<div
									key={img.id}
									className="relative group w-20 h-20 rounded-xl overflow-hidden"
									style={{ border: "1px solid var(--border)" }}
								>
									<SecureImage fileId={img.file_id} fallbackUrl={img.url} alt={img.filename} className="w-full h-full object-cover" />
									<button
										type="button"
										onClick={async () => {
											try {
												await api.deletePostImage(postId, img.id);
												setImages((prev) => prev.filter((i) => i.id !== img.id));
											} catch { /* silent */ }
										}}
										className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
										style={{ background: "rgba(0,0,0,0.65)" }}
									>
										<X size={14} style={{ color: "white" }} />
									</button>
								</div>
							))}
						</div>
					)}

					<div className="mt-5">
						<ImageUpload postId={postId} onUploaded={(uploaded) => setImages((prev) => [...prev, ...uploaded])} compact />
					</div>
				</div>
			</div>

			{/* ─── Right: Publish panel ─── */}
			<div className="w-72 flex-shrink-0 sticky top-0 h-screen overflow-y-auto flex flex-col" style={{ background: "var(--bg-2)" }}>
				<div className="flex-1 p-5 space-y-6 overflow-y-auto">

					{/* ── Platforms ── */}
					<section>
						<p className="sidebar-label">Platforms</p>
						<div className="space-y-1">
							{KNOWN_PLATFORMS.map(({ key, label, color }) => {
								const status        = platformStatuses[key];
								const enabled       = status?.enabled;
								const alreadyPosted = postedPlatformKeys.has(key);
								const selected      = selectedPlatforms.includes(key);
								const showFields    = selected && enabled && !alreadyPosted;
								return (
									<div key={key}>
										<div
											onClick={() => !alreadyPosted && togglePlatform(key)}
											className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg select-none transition-all"
											style={{
												cursor: enabled && !alreadyPosted ? "pointer" : "not-allowed",
												opacity: !enabled && !alreadyPosted ? 0.4 : 1,
												background: showFields ? "rgba(168,230,61,0.06)" : "transparent",
											}}
											onMouseEnter={(e) => { if (enabled && !alreadyPosted) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
											onMouseLeave={(e) => { e.currentTarget.style.background = showFields ? "rgba(168,230,61,0.06)" : "transparent"; }}
										>
											{/* Checkbox */}
											<span
												className="w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold transition-all"
												style={{
													background: alreadyPosted ? "var(--green)" : (selected && enabled ? "var(--accent)" : "transparent"),
													border:     `1px solid ${alreadyPosted ? "var(--green)" : (selected && enabled ? "var(--accent)" : "var(--border-3)")}`,
													color:      "#080808",
												}}
											>
												{(alreadyPosted || (selected && enabled)) ? "✓" : null}
											</span>
											{/* Platform label */}
											<span className="text-xs font-semibold" style={{ color: enabled ? color : "var(--text-3)" }}>{label}</span>
											{alreadyPosted && <span className="ml-auto text-[10px] font-mono" style={{ color: "var(--green)" }}>posted</span>}
											{!enabled && !alreadyPosted && <span className="ml-auto text-[10px]" style={{ color: "var(--text-3)" }}>off</span>}
										</div>

										{/* Per-platform fields */}
										{showFields && (
											<div className="ml-7 mt-1 p-3 rounded-lg space-y-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
												{key === "reddit" && (<>
													<div>
														<p className="platform-field-label">Subreddit <span style={{ color: "var(--red)" }}>*</span></p>
														<div className="flex items-center gap-1">
															<span className="text-xs" style={{ color: "var(--text-3)" }}>r/</span>
															<input type="text" placeholder="programming" className="input-field text-xs flex-1" value={getPF("reddit", "subreddit")} onChange={(e) => setPlatformField("reddit", "subreddit", e.target.value)} />
														</div>
													</div>
													<div>
														<p className="platform-field-label">Reddit title <span style={{ color: "var(--red)" }}>*</span></p>
														<input type="text" placeholder="Post headline…" className="input-field text-xs" value={getPF("reddit", "title")} onChange={(e) => setPlatformField("reddit", "title", e.target.value)} />
													</div>
													<div>
														<p className="platform-field-label">Flair</p>
														<input type="text" placeholder="Discussion" className="input-field text-xs" value={getPF("reddit", "flair")} onChange={(e) => setPlatformField("reddit", "flair", e.target.value)} />
													</div>
												</>)}
												{key === "devto" && (<>
													<div>
														<p className="platform-field-label">Tags</p>
														<input type="text" placeholder="javascript, webdev…" className="input-field text-xs" value={getPF("devto", "tags")} onChange={(e) => setPlatformField("devto", "tags", e.target.value)} />
													</div>
													<div>
														<p className="platform-field-label">Series</p>
														<input type="text" placeholder="Building in Public" className="input-field text-xs" value={getPF("devto", "series")} onChange={(e) => setPlatformField("devto", "series", e.target.value)} />
													</div>
													<div>
														<p className="platform-field-label">Canonical URL</p>
														<input type="url" placeholder="https://…" className="input-field text-xs" value={getPF("devto", "canonicalUrl")} onChange={(e) => setPlatformField("devto", "canonicalUrl", e.target.value)} />
													</div>
												</>)}
												{key === "linkedin" && (
													<div>
														<p className="platform-field-label">Visibility</p>
														<div className="flex gap-1.5">
															{[["public", "Everyone"], ["connections", "Connections"]].map(([val, lbl]) => (
																<button key={val} type="button"
																	onClick={() => setPlatformField("linkedin", "visibility", val)}
																	className="flex-1 px-2 py-1 rounded text-[11px] font-semibold transition-all"
																	style={{
																		background: getPF("linkedin", "visibility", "public") === val ? "var(--accent-dim2)" : "transparent",
																		color:      getPF("linkedin", "visibility", "public") === val ? "var(--accent)" : "var(--text-3)",
																		border:     `1px solid ${getPF("linkedin", "visibility", "public") === val ? "rgba(168,230,61,0.3)" : "var(--border-2)"}`,
																	}}>
																	{lbl}
																</button>
															))}
														</div>
													</div>
												)}
												{key === "bluesky" && (
													<div>
														<p className="platform-field-label">Language</p>
														<input type="text" placeholder="en" maxLength={5} className="input-field text-xs" value={getPF("bluesky", "language", "en")} onChange={(e) => setPlatformField("bluesky", "language", e.target.value)} />
													</div>
												)}
												{(key === "twitter" || key === "threads") && (
													<p className="text-[11px]" style={{ color: "var(--text-3)" }}>No extra settings needed.</p>
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
								{ id: "now",    label: "Publish now",          icon: Send    },
								{ id: "fixed",  label: "Exact time",            icon: Clock   },
								{ id: "random", label: "Random within window",  icon: Shuffle },
							].map(({ id, label }) => (
								<label
									key={id}
									className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all"
									style={{
										background: scheduleMode === id ? "rgba(168,230,61,0.06)" : "transparent",
									}}
									onMouseEnter={(e) => { if (scheduleMode !== id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
									onMouseLeave={(e) => { e.currentTarget.style.background = scheduleMode === id ? "rgba(168,230,61,0.06)" : "transparent"; }}
								>
									<span
										className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all"
										style={{
											borderColor: scheduleMode === id ? "var(--accent)" : "var(--border-3)",
										}}
									>
										{scheduleMode === id && (
											<span className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
										)}
									</span>
									<input type="radio" name="scheduleMode" value={id} checked={scheduleMode === id} onChange={() => setScheduleMode(id)} className="sr-only" />
									<span className="text-sm" style={{ color: scheduleMode === id ? "var(--text)" : "var(--text-2)" }}>{label}</span>
								</label>
							))}
						</div>
						{scheduleMode === "fixed" && (
							<div className="mt-2.5">
								<input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-field text-sm" />
							</div>
						)}
						{scheduleMode === "random" && (
							<div className="mt-2.5 grid grid-cols-2 gap-2">
								<div>
									<p className="text-[10px] mb-1" style={{ color: "var(--text-3)" }}>From</p>
									<input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className="input-field text-sm" />
								</div>
								<div>
									<p className="text-[10px] mb-1" style={{ color: "var(--text-3)" }}>Until</p>
									<input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className="input-field text-sm" />
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

					{/* ── Notes ── */}
					<section>
						<button
							type="button"
							onClick={() => setShowNotes(!showNotes)}
							className="sidebar-label flex items-center gap-1.5 transition-colors w-full text-left"
							style={{ color: showNotes ? "var(--text-2)" : "var(--text-3)" }}
						>
							Notes
							<span className="text-[8px] ml-auto">{showNotes ? "▲" : "▼"}</span>
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

				{/* ── Action footer ── */}
				<div className="p-4 space-y-2 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
					{allPublished ? (
						<>
							<p className="text-[11px] text-center pb-1" style={{ color: "var(--text-3)" }}>Published everywhere.</p>
							<button type="button" onClick={duplicateAsDraft} disabled={publishing} className="btn-primary w-full justify-center">
								{publishing ? <Loader size={14} className="animate-spin" /> : <CopyPlus size={14} />}
								Duplicate as Draft
							</button>
							<button type="button" onClick={() => navigate("/posts")} className="btn-ghost w-full justify-center">Back to Library</button>
						</>
					) : isPosted ? (
						<>
							<button type="button" onClick={duplicateAsDraft} disabled={publishing} className="btn-primary w-full justify-center">
								{publishing ? <Loader size={14} className="animate-spin" /> : <CopyPlus size={14} />}
								Duplicate as Draft
							</button>
							<button type="button" onClick={() => navigate("/posts")} className="btn-ghost w-full justify-center">Back to Library</button>
						</>
					) : (
						<>
							<button type="button" onClick={handlePublish} disabled={publishing || discarding} className="btn-primary w-full justify-center">
								{publishing ? <Loader size={14} className="animate-spin" /> : publishIcon}
								{publishLabel}
							</button>
							<button
								type="button"
								onClick={handleDiscard}
								disabled={publishing || discarding}
								className="btn-ghost w-full justify-center transition-all"
								style={{ borderColor: "var(--border-2)" }}
								onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(248,113,113,0.4)"; e.currentTarget.style.color = "var(--red)"; }}
								onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; e.currentTarget.style.color = ""; }}
							>
								{discarding ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
								Discard draft
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
