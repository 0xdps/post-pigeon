import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, Loader, Send, Clock, ArrowLeft, Trash2, Shuffle, Check, Image as ImageIcon, Upload } from "lucide-react";
import { api } from "../api.js";
import ThreadBuilder from "../components/ThreadBuilder.jsx";
import { SecureImage } from "../components/SecureImage.jsx";

/* ── Platform config ─────────────────────────────────────────────────────── */
const PLATFORMS = [
	{ key: "twitter",  label: "X / Twitter", color: "#60a5fa" },
	{ key: "threads",  label: "Threads",      color: "#a78bfa" },
	{ key: "linkedin", label: "LinkedIn",     color: "#38bdf8" },
	{ key: "reddit",   label: "Reddit",       color: "#fb923c" },
	{ key: "devto",    label: "Dev.to",       color: "#a3e635" },
	{ key: "bluesky",  label: "Bluesky",      color: "#67e8f9" },
];

const BLANK_CONTENT = () => [{ id: `c-${Date.now()}`, text: "", media_ids: [], sequence: 1 }];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const isDbId = (id) => id && /^[a-zA-Z0-9_-]{10,}/.test(id) && !id.startsWith("c-");

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SaveIndicator({ status }) {
	if (status === "idle") return null;
	const map = {
		pending: { text: "", dot: true },
		saving:  { text: "saving…", color: "var(--text-3)" },
		saved:   { text: "saved", color: "var(--green)" },
		error:   { text: "save failed", color: "var(--red)" },
	};
	const s = map[status];
	if (!s) return null;
	return s.dot
		? <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--amber)" }} />
		: <span className="text-[11px] font-mono" style={{ color: s.color }}>{s.text}</span>;
}

function PlatformRow({ platform, status, selected, alreadyPosted, onToggle }) {
	const enabled = status?.enabled;
	const connected = enabled && status?.auth_status === "ok";
	const showFields = selected && enabled && !alreadyPosted;

	return (
		<div key={platform.key}>
			<div
				onClick={() => !alreadyPosted && enabled && onToggle(platform.key)}
				className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg select-none transition-all"
				style={{
					cursor: enabled && !alreadyPosted ? "pointer" : "not-allowed",
					opacity: !enabled ? 0.4 : 1,
					background: showFields ? "rgba(168,230,61,0.06)" : "transparent",
				}}
				onMouseEnter={e => { if (enabled && !alreadyPosted) e.currentTarget.style.background = showFields ? "rgba(168,230,61,0.06)" : "rgba(255,255,255,0.04)"; }}
				onMouseLeave={e => { e.currentTarget.style.background = showFields ? "rgba(168,230,61,0.06)" : "transparent"; }}
			>
				{/* Checkbox */}
				<span
					className="w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold transition-all"
					style={{
						background: alreadyPosted ? "var(--green)" : (selected && enabled ? "var(--accent)" : "transparent"),
						border: `1px solid ${alreadyPosted ? "var(--green)" : (selected && enabled ? "var(--accent)" : "var(--border-2)")}`,
						color: "#080808",
					}}
				>
					{(alreadyPosted || (selected && enabled)) ? <Check size={9} strokeWidth={3} /> : null}
				</span>

				{/* Connection dot */}
				<span
					className="w-1.5 h-1.5 rounded-full shrink-0"
					style={{ background: connected ? "var(--green)" : enabled ? "var(--amber)" : "var(--border-2)" }}
					title={connected ? "Connected" : enabled ? "Not configured" : "Disabled"}
				/>

				{/* Label */}
				<span className="text-sm flex-1" style={{ color: enabled ? platform.color : "var(--text-3)" }}>
					{platform.label}
				</span>

				{alreadyPosted && <span className="text-[10px] font-mono" style={{ color: "var(--green)" }}>posted</span>}
				{!enabled && <span className="text-[10px]" style={{ color: "var(--text-3)" }}>off</span>}
				{enabled && !connected && !alreadyPosted && <span className="text-[10px]" style={{ color: "var(--amber)" }}>setup</span>}
			</div>
		</div>
	);
}

/* ── Main component ──────────────────────────────────────────────────────── */

export default function Compose() {
	const { id: postId } = useParams();
	const navigate = useNavigate();

	const [post, setPost]             = useState(null);
	const [loading, setLoading]       = useState(true);
	const [images, setImages]         = useState([]);
	const [publishing, setPublishing] = useState(false);
	const [discarding, setDiscarding] = useState(false);
	const [uploadingImg, setUploadingImg] = useState(false);
	const [autoSaveStatus, setAutoSaveStatus] = useState("idle");

	const [platformStatuses, setPlatformStatuses] = useState({});
	const [selectedPlatforms, setSelectedPlatforms] = useState(["twitter"]);
	const [publishedJobs, setPublishedJobs] = useState([]);

	const [scheduleMode, setScheduleMode] = useState("now");
	const [scheduledAt, setScheduledAt]   = useState("");
	const [windowStart, setWindowStart]   = useState("09:00");
	const [windowEnd, setWindowEnd]       = useState("21:00");
	const [showNotes, setShowNotes]       = useState(false);

	// Post picker for reply chaining
	const [pickerPosts, setPickerPosts]   = useState(null); // null = not loaded yet
	const [pickerSearch, setPickerSearch] = useState("");

	const saveTimerRef        = useRef(null);
	const postRef             = useRef(null);
	const postIdRef           = useRef(postId);
	const contentIdMapRef     = useRef({});
	const imgInputRef         = useRef(null);
	// Prevents init effect from reloading post when URL changes due to lazy creation
	const wasLazyCreatedRef   = useRef(false);

	useEffect(() => { postRef.current = post; }, [post]);
	useEffect(() => { postIdRef.current = postId; }, [postId]);

	/* ── Init ── */
	useEffect(() => {
		loadPlatforms();
		if (postId) {
			// Skip reload if the URL change was triggered by our own lazy creation
			// (post data is already in state — reloading would wipe unsaved content)
			if (wasLazyCreatedRef.current) {
				wasLazyCreatedRef.current = false;
				setLoading(false);
				return;
			}
			loadPost();
		} else {
			// Don't create in DB yet — wait until user types (lazy creation)
			setPost({ type: "standalone", title: "Untitled", metadata: {}, content: BLANK_CONTENT() });
			setLoading(false);
		}
	}, [postId]); // eslint-disable-line

	const loadPlatforms = async () => {
		try {
			const res = await api.getPlatforms();
			const arr = Array.isArray(res) ? res : (res?.platforms || []);
			const map = {};
			for (const p of arr) {
			map[p.key] = {
				enabled:        !!p.enabled,
				auth_status:    p.auth_status,
				supportsThread: p.catalog?.capabilities?.supportsThread ?? false,
			};
			}
			setPlatformStatuses(map);
		} catch { /* silent */ }
	};


	const loadPost = async () => {
		setLoading(true);
		try {
			const [postRes, imgRes, jobsRes] = await Promise.all([
				api.getPost(postId),
				api.listPostImages(postId),
				api.listPublishJobs({ post_id: postId }),
			]);

			// Handle both response shapes
			const rawPost = postRes?.post || postRes;
			if (!rawPost?.id) { setLoading(false); return; }

			// Load content
			const contentRes = await api.listPostContent(postId);
			const content = Array.isArray(contentRes)
				? contentRes
				: (contentRes?.content || []);

		const filledContent = content.length > 0
			? content.map(c => ({ id: c.id, text: c.text || "", media_ids: c.media_ids || [], sequence: c.sequence || 1, reply_to_tweet_id: c.reply_to_tweet_id || null, reply_to_post_id: c.reply_to_post_id || null }))
			: BLANK_CONTENT();

			setPost({ ...rawPost, content: filledContent });

			if (imgRes?.success || imgRes?.images) setImages(imgRes.images || []);

			const allJobs = Array.isArray(jobsRes) ? jobsRes : (jobsRes?.jobs || []);
			const posted = allJobs.filter(j => j.status === "posted");
			setPublishedJobs(posted);
			const postedKeys = new Set(posted.map(j => j.platform_key));
			setSelectedPlatforms(prev => prev.filter(k => !postedKeys.has(k)));

			// Pre-populate content ID map
			content.forEach(c => {
				if (c.id) contentIdMapRef.current[c.id] = c.id;
			});
		} catch (err) {
			console.error("Failed to load post:", err);
		} finally {
			setLoading(false);
		}
	};

	/* ── Post picker (for reply chaining) ── */
	const loadPickerPosts = useCallback(async () => {
		if (pickerPosts !== null) return; // already loaded
		try {
			const res = await api.listPosts({ limit: 200, orderBy: "created_at" });
			const all = Array.isArray(res) ? res : (res?.posts || []);
			// Exclude the current post from the picker list
			setPickerPosts(all.filter(p => p.id !== postIdRef.current));
		} catch {
			setPickerPosts([]);
		}
	}, [pickerPosts]);

	/* ── Auto-save (creates post on first save if not yet in DB) ── */
	const performSave = useCallback(async () => {
		const p = postRef.current;
		if (!p) return;

		// Skip if nothing meaningful has been written yet
		const hasContent = p.content?.some(c => c.text?.trim().length > 0);
		if (!hasContent) return;

		let id = postIdRef.current;

		// Lazy creation: post doesn't exist in DB yet
		if (!id) {
			const newId = `post-${Date.now()}`;
			try {
				const firstLine = p.content?.[0]?.text?.slice(0, 100).trim() || "Untitled";
				await api.createPost({ id: newId, type: p.type, title: firstLine, metadata: p.metadata || {} });
				postIdRef.current = newId;
				id = newId;
				wasLazyCreatedRef.current = true;
				navigate(`/compose/${newId}`, { replace: true });
			} catch {
				setAutoSaveStatus("error");
				return;
			}
		}

		if (p.status === "posted") return;
		setAutoSaveStatus("saving");

		try {
			const firstLine = p.content?.[0]?.text?.slice(0, 100).trim() || "Untitled";
			await api.updatePost(id, {
				title:    firstLine,
				type:     p.type,
				metadata: p.metadata,
			});

			const idMap = contentIdMapRef.current;
			for (const c of p.content || []) {
				if (!c.text?.trim()) continue;
				const dbId = idMap[c.id] || (isDbId(c.id) ? c.id : null);
				const contentPayload = {
					text:              c.text,
					media_ids:         c.media_ids || [],
					sequence:          c.sequence,
					reply_to_tweet_id: c.reply_to_tweet_id || null,
					reply_to_post_id:  c.reply_to_post_id  || null,
				};
				if (dbId) {
					await api.updatePostContent(id, dbId, contentPayload);
				} else {
					const res = await api.addPostContent(id, contentPayload);
					if (res?.id || res?.contentId) {
						contentIdMapRef.current = { ...idMap, [c.id]: res.id || res.contentId };
					}
				}
			}
			setAutoSaveStatus("saved");
			setTimeout(() => setAutoSaveStatus("idle"), 2500);
		} catch {
			setAutoSaveStatus("error");
		}
	}, [navigate]);

	useEffect(() => {
		if (!post) return;
		setAutoSaveStatus("pending");
		clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(performSave, 1500);
		return () => clearTimeout(saveTimerRef.current);
	}, [post?.title, post?.type, post?.content, post?.metadata]); // eslint-disable-line

	const saveNow = useCallback(async () => {
		clearTimeout(saveTimerRef.current);
		await performSave();
	}, [performSave]);

	/* ── Setters ── */
	const set     = (key, val) => setPost(p => ({ ...p, [key]: val }));
	const setMeta = (key, val) => setPost(p => ({ ...p, metadata: { ...p.metadata, [key]: val } }));
	const setPF   = (pkey, field, val) =>
		setPost(p => ({ ...p, metadata: { ...p.metadata, platforms: { ...(p.metadata?.platforms || {}), [pkey]: { ...(p.metadata?.platforms?.[pkey] || {}), [field]: val } } } }));
	const getPF   = (pkey, field, def = "") => post?.metadata?.platforms?.[pkey]?.[field] ?? def;

	const updateContent = (index, updates) => {
		const next = [...(post.content || [])];
		next[index] = { ...next[index], ...updates };
		set("content", next);
	};

	const togglePlatform = (key) => {
		if (!platformStatuses[key]?.enabled) return;
		setSelectedPlatforms(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
	};

	/* ── Image upload ── */
	const handleImageFiles = async (files) => {
		if (!files?.length) return;
		setUploadingImg(true);
		try {
			// If post not yet saved, force a save first to get an ID
			if (!postIdRef.current) {
				await performSave();
			}
			if (!postIdRef.current) {
				alert("Write something first so the post can be saved before attaching images.");
				setUploadingImg(false);
				return;
			}
			const res = await api.uploadPostImages(postIdRef.current, Array.from(files));
			if (res?.images) setImages(prev => [...prev, ...res.images]);
		} catch { /* silent */ }
		setUploadingImg(false);
	};

	/* ── Publish ── */
	const handlePublish = async () => {
		if (!selectedPlatforms.length) { alert("Select at least one platform."); return; }
		if (scheduleMode === "fixed" && !scheduledAt) { alert("Pick a date and time."); return; }
		const hasContent = post?.content?.some(c => c.text?.trim().length > 0);
		if (!hasContent) { alert("Write something first before publishing."); return; }
		setPublishing(true);
		try {
			await saveNow();
			// If still no postId after save (save failed), bail
			if (!postIdRef.current) {
				alert("Could not save post. Please try again.");
				setPublishing(false);
				return;
			}
			const platforms = selectedPlatforms.map(key => {
				if (scheduleMode === "fixed")  return { key, mode: "fixed",  scheduled_at: new Date(scheduledAt).getTime() };
				if (scheduleMode === "random") return { key, mode: "random", window_start: windowStart, window_end: windowEnd };
				return { key, mode: "fixed", scheduled_at: Date.now() + 3000 };
			});
			const result = await api.createSchedule({ post_id: postId, platforms });
			if (scheduleMode === "now") {
				for (const job of result?.jobs || []) {
					if (job?.job_id) await api.publishJob(job.job_id);
					else if (job?.id) await api.publishJob(job.id);
				}
			}
			navigate("/activity");
		} catch (err) {
			alert("Failed to publish: " + (err.message || "Unknown error"));
		} finally {
			setPublishing(false);
		}
	};

	const handleDiscard = async () => {
		if (!window.confirm("Delete this draft? This cannot be undone.")) return;
		setDiscarding(true);
		try {
			await api.deletePost(postId);
			navigate("/library");
		} catch (err) {
			alert("Failed: " + err.message);
			setDiscarding(false);
		}
	};

	/* ── Derived ── */
	const postedPlatformKeys = new Set(publishedJobs.map(j => j.platform_key));
	const isPosted = post?.status === "posted";
	const allPublished = isPosted && PLATFORMS.filter(p => platformStatuses[p.key]?.enabled).every(p => postedPlatformKeys.has(p.key));

	// Platforms selected that don't support threads (only relevant in thread mode)
	const threadUnsupportedPlatforms = post?.type === "thread"
		? selectedPlatforms.filter(k => !platformStatuses[k]?.supportsThread)
		: [];


	const publishLabel = {
		now:    publishing ? "Publishing…" : "Publish Now",
		fixed:  publishing ? "Scheduling…" : "Schedule",
		random: publishing ? "Scheduling…" : "Schedule in window",
	}[scheduleMode];

	const publishIcon = {
		now:    <Send size={14} />,
		fixed:  <Clock size={14} />,
		random: <Shuffle size={14} />,
	}[scheduleMode];

	/* ── Render ── */
	if (loading) {
		return (
			<div className="flex items-center justify-center h-64 gap-2 text-sm" style={{ color: "var(--text-2)" }}>
				<Loader size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
				Loading…
			</div>
		);
	}

	if (!post) return null;

	return (
		<div className="flex h-full overflow-hidden" style={{ background: "var(--bg)" }}>

			{/* ════════════════════════════════
			    LEFT — Writing area
			    ════════════════════════════════ */}
			<div className="flex-1 flex flex-col min-w-0" style={{ borderRight: "1px solid var(--border)" }}>

				{/* Top bar */}
				<div
					className="h-12 flex items-center gap-3 px-5 shrink-0"
					style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}
				>
					<button
						onClick={() => navigate("/library")}
						className="flex items-center gap-1.5 text-sm transition-colors shrink-0"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={e => e.currentTarget.style.color = "var(--text-2)"}
						onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}
					>
						<ArrowLeft size={13} /> Posts
					</button>

					<span style={{ color: "var(--border-2)" }}>/</span>

					<span className="text-sm truncate" style={{ color: "var(--text-3)" }}>
						{post.title && post.title !== "Untitled"
							? post.title
							: post.content?.[0]?.text?.slice(0, 60) || "New post"}
					</span>

					{isPosted && (
						<span
							className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
							style={{ background: "rgba(52,211,153,0.12)", color: "var(--green)", border: "1px solid rgba(52,211,153,0.2)" }}
						>
							Published
						</span>
					)}

					<div className="ml-auto shrink-0">
						<SaveIndicator status={autoSaveStatus} />
					</div>
				</div>

				{/* ── Platform selector bar — pick first, then write ── */}
				<div
					className="px-6 py-3 shrink-0 flex items-center gap-2 flex-wrap"
					style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}
				>
					<span className="text-xs font-semibold tracking-wide uppercase shrink-0 mr-1" style={{ color: "var(--text-3)" }}>
						Post to
					</span>
					{PLATFORMS.map(platform => {
						const status    = platformStatuses[platform.key];
						const enabled   = status?.enabled;
						const connected = enabled && status?.auth_status === "ok";
						const selected  = selectedPlatforms.includes(platform.key);
						const posted    = postedPlatformKeys.has(platform.key);

						return (
							<button
								key={platform.key}
								onClick={() => !posted && enabled && togglePlatform(platform.key)}
								disabled={!enabled || posted}
								title={!enabled ? `${platform.label} — not enabled` : !connected ? `${platform.label} — needs setup` : platform.label}
								className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
								style={{
									background: posted
										? "rgba(52,211,153,0.1)"
										: selected
										? "var(--accent-dim2)"
										: "var(--bg-3)",
									color: posted
										? "var(--green)"
										: selected
										? "var(--accent)"
										: enabled ? "var(--text-2)" : "var(--text-3)",
									border: `1px solid ${posted ? "rgba(52,211,153,0.25)" : selected ? "rgba(168,230,61,0.3)" : "var(--border)"}`,
									opacity: !enabled ? 0.4 : 1,
									cursor: (!enabled || posted) ? "not-allowed" : "pointer",
								}}
							>
								{/* Connection dot */}
								<span
									className="w-1.5 h-1.5 rounded-full shrink-0"
									style={{
										background: posted ? "var(--green)"
											: connected ? "var(--green)"
											: enabled ? "var(--amber)"
											: "var(--border-2)",
									}}
								/>
								{platform.label}
								{selected && !posted && (
									<Check size={10} strokeWidth={3} />
								)}
								{posted && (
									<Check size={10} strokeWidth={3} />
								)}
							</button>
						);
					})}
					{Object.keys(platformStatuses).length === 0 && (
						<span className="text-xs" style={{ color: "var(--text-3)" }}>
							No platforms connected —{" "}
							<button onClick={() => navigate("/channels")} className="underline" style={{ color: "var(--accent)" }}>
								set up platforms
							</button>
						</span>
					)}
				</div>

				{/* Platform-specific fields (Reddit, Dev.to etc.) — inline below selector */}
				{selectedPlatforms.some(k => ["reddit","devto","linkedin","bluesky"].includes(k) && platformStatuses[k]?.enabled && !postedPlatformKeys.has(k)) && (
					<div
						className="px-6 py-3 shrink-0 flex flex-wrap gap-x-6 gap-y-2 items-end"
						style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-3)" }}
					>
						{selectedPlatforms.filter(k => platformStatuses[k]?.enabled && !postedPlatformKeys.has(k)).map(key => {
							const p = PLATFORMS.find(x => x.key === key);
							if (!p) return null;
							if (key === "reddit") return (
								<div key={key} className="flex items-center gap-3 flex-wrap">
									<span className="text-xs font-bold" style={{ color: p.color }}>Reddit</span>
									<div className="flex items-center gap-1">
										<span className="text-xs" style={{ color: "var(--text-3)" }}>r/</span>
										<input type="text" placeholder="subreddit" className="input-field text-xs py-1" style={{ width: "120px" }}
											value={getPF("reddit", "subreddit")} onChange={e => setPF("reddit", "subreddit", e.target.value)} />
									</div>
									<input type="text" placeholder="Post title (required)" className="input-field text-xs py-1" style={{ width: "200px" }}
										value={getPF("reddit", "title")} onChange={e => setPF("reddit", "title", e.target.value)} />
								</div>
							);
							if (key === "devto") return (
								<div key={key} className="flex items-center gap-3 flex-wrap">
									<span className="text-xs font-bold" style={{ color: p.color }}>Dev.to</span>
									<input type="text" placeholder="Tags (comma separated)" className="input-field text-xs py-1" style={{ width: "200px" }}
										value={getPF("devto", "tags")} onChange={e => setPF("devto", "tags", e.target.value)} />
									<input type="text" placeholder="Series (optional)" className="input-field text-xs py-1" style={{ width: "150px" }}
										value={getPF("devto", "series")} onChange={e => setPF("devto", "series", e.target.value)} />
								</div>
							);
							if (key === "linkedin") return (
								<div key={key} className="flex items-center gap-3">
									<span className="text-xs font-bold" style={{ color: p.color }}>LinkedIn</span>
									<div className="flex gap-1">
										{[["public","Everyone"],["connections","Connections"]].map(([val, lbl]) => (
											<button key={val} type="button" onClick={() => setPF("linkedin","visibility",val)}
												className="px-2 py-0.5 rounded text-xs transition-all"
												style={{
													background: getPF("linkedin","visibility","public") === val ? "var(--accent-dim2)" : "var(--bg-4)",
													color: getPF("linkedin","visibility","public") === val ? "var(--accent)" : "var(--text-3)",
													border: `1px solid ${getPF("linkedin","visibility","public") === val ? "rgba(168,230,61,0.3)" : "var(--border)"}`,
												}}>
												{lbl}
											</button>
										))}
									</div>
								</div>
							);
							if (key === "bluesky") return (
								<div key={key} className="flex items-center gap-3">
									<span className="text-xs font-bold" style={{ color: p.color }}>Bluesky</span>
									<input type="text" placeholder="Language (e.g. en)" maxLength={5} className="input-field text-xs py-1" style={{ width: "100px" }}
										value={getPF("bluesky","language","en")} onChange={e => setPF("bluesky","language",e.target.value)} />
								</div>
							);
							return null;
						})}
					</div>
				)}

				{/* Writing area */}
				<div className="flex-1 overflow-y-auto px-10 py-8">

					{/* Post type selector */}
					<div className="flex gap-1.5 mb-5">
						{[
							{ value: "standalone", label: "Post" },
							{ value: "thread",     label: "Thread" },
							{ value: "reply",      label: "Reply" },
						].map(t => (
							<button
								key={t.value}
								type="button"
								disabled={isPosted}
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
								onChange={e => updateContent(0, { text: e.target.value })}
								placeholder="What do you want to say?"
								disabled={isPosted}
								rows={14}
								className="textarea-field"
								style={{ width: "100%", fontSize: "0.9375rem", lineHeight: "1.7" }}
							/>
							<div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
								{!isPosted && (
									<button
										type="button"
										onClick={() => {
											set("type", "thread");
											set("content", [
												...(post.content || []),
												{ id: `c-${Date.now()}`, text: "", media_ids: [], sequence: (post.content?.length || 1) + 1 },
											]);
										}}
										className="text-xs transition-colors"
										style={{ color: "var(--text-3)" }}
										onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"}
										onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}
									>
										+ Continue as thread
									</button>
								)}
				</div>
			</>
			)}

		{/* ── Thread ── */}
		{post.type === "thread" && (
			<>
				<ThreadBuilder
					content={post.content || []}
					onUpdate={updated => set("content", updated)}
					disabled={isPosted}
				/>

					{/* Warn when selected platforms don't support threads */}
					{threadUnsupportedPlatforms.length > 0 && (
						<div
							className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg text-xs mt-1"
							style={{
								background: "var(--amber-dim)",
								border: "1px solid rgba(251,146,60,0.2)",
								color: "var(--amber)",
							}}
						>
							<span className="shrink-0 mt-px">⚠</span>
							<span>
								<strong>{threadUnsupportedPlatforms.map(k => PLATFORMS.find(p => p.key === k)?.label || k).join(", ")}</strong>
								{threadUnsupportedPlatforms.length === 1 ? " doesn't" : " don't"} support threads —
								only the <strong>first tweet</strong> will be posted there.
							</span>
						</div>
					)}
				</>
			)}

					{/* ── Reply ── */}
			{post.type === "reply" && (
				<div className="space-y-4">
					{/* Reply target */}
					<div>
						<p className="text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: "var(--text-3)" }}>
							Replying to
						</p>

						{/* Mode toggle */}
						{!isPosted && (
							<div className="flex gap-0.5 mb-3 p-0.5 rounded-lg w-fit" style={{ background: "var(--bg-3)" }}>
								{[
									{ id: "external", label: "External tweet" },
									{ id: "linked",   label: "Scheduled post" },
								].map(m => {
									const active = m.id === "linked"
										? !!post.content?.[0]?.reply_to_post_id
										: !post.content?.[0]?.reply_to_post_id;
									return (
										<button
											key={m.id}
											type="button"
											onClick={() => {
												if (m.id === "linked") {
													updateContent(0, { reply_to_post_id: "__pick__", reply_to_tweet_id: null });
													loadPickerPosts();
												} else {
													updateContent(0, { reply_to_post_id: null });
												}
											}}
											className="text-xs px-3 py-1.5 rounded-md transition-all font-medium"
											style={{
												background: active ? "var(--bg-2)" : "transparent",
												color: active ? "var(--text)" : "var(--text-3)",
												border: active ? "1px solid var(--border)" : "1px solid transparent",
											}}
										>
											{m.label}
										</button>
									);
								})}
							</div>
						)}

						{/* External tweet mode */}
						{!post.content?.[0]?.reply_to_post_id && (
							<>
								<input
									type="text"
									value={post.content?.[0]?.reply_to_tweet_id || ""}
									onChange={e => updateContent(0, { reply_to_tweet_id: e.target.value })}
									onBlur={e => {
										const raw = e.target.value.trim();
										const match = raw.match(/\/status\/(\d+)/);
										const id = match ? match[1] : (/^\d+$/.test(raw) ? raw : raw);
										if (id !== raw) updateContent(0, { reply_to_tweet_id: id });
									}}
									placeholder="https://x.com/user/status/… or tweet ID"
									className="input-field"
									disabled={isPosted}
								/>
								{(() => {
									const raw = post.content?.[0]?.reply_to_tweet_id || "";
									const isId = /^\d+$/.test(raw.trim());
									const isUrl = raw.includes("/status/");
									if (!raw) return null;
									if (isId) return <p className="text-[11px] mt-1" style={{ color: "var(--green)" }}>✓ Tweet ID: {raw.trim()}</p>;
									if (!isUrl && !isId) return <p className="text-[11px] mt-1" style={{ color: "var(--red)" }}>Not a valid tweet URL or ID</p>;
									return null;
								})()}
							</>
						)}

						{/* Linked post mode */}
						{!!post.content?.[0]?.reply_to_post_id && (
							<div>
								{/* Search input */}
								<input
									type="text"
									value={pickerSearch}
									onChange={e => setPickerSearch(e.target.value)}
									placeholder="Search posts…"
									className="input-field mb-2"
									disabled={isPosted}
								/>

								{/* Currently selected */}
								{post.content?.[0]?.reply_to_post_id !== "__pick__" && (() => {
									const sel = pickerPosts?.find(p => p.id === post.content[0].reply_to_post_id);
									return sel ? (
										<div
											className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
											style={{ background: "var(--accent-dim)", border: "1px solid rgba(91,184,245,0.25)" }}
										>
											<Check size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
											<span className="text-sm flex-1 truncate" style={{ color: "var(--text)" }}>{sel.title || sel.id}</span>
											<span className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>{sel.status}</span>
											{!isPosted && (
												<button
													type="button"
													onClick={() => updateContent(0, { reply_to_post_id: "__pick__" })}
													className="text-[10px] underline ml-1"
													style={{ color: "var(--text-3)" }}
												>
													change
												</button>
											)}
										</div>
									) : null;
								})()}

								{/* Post list */}
								{(post.content?.[0]?.reply_to_post_id === "__pick__" || !pickerPosts?.find(p => p.id === post.content?.[0]?.reply_to_post_id)) && (
									<div
										className="rounded-lg overflow-hidden"
										style={{ border: "1px solid var(--border)", maxHeight: "240px", overflowY: "auto" }}
									>
										{pickerPosts === null ? (
											<div className="flex items-center justify-center gap-2 py-6 text-sm" style={{ color: "var(--text-3)" }}>
												<Loader size={14} className="animate-spin" />
												Loading posts…
											</div>
										) : (() => {
											const q = pickerSearch.toLowerCase();
											const filtered = pickerPosts.filter(p =>
												!q || (p.title || p.id).toLowerCase().includes(q)
											);
											if (!filtered.length) return (
												<div className="py-6 text-center text-sm" style={{ color: "var(--text-3)" }}>No posts found</div>
											);
											return filtered.map((p, i) => {
												const isSelected = post.content?.[0]?.reply_to_post_id === p.id;
												const scheduledMs = p.scheduled_at ? Number(p.scheduled_at) : null;
												const scheduledLabel = scheduledMs
													? new Date(scheduledMs).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
													: null;
												return (
													<div
														key={p.id}
														onClick={() => !isPosted && updateContent(0, { reply_to_post_id: p.id })}
														className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors"
														style={{
															borderTop: i > 0 ? "1px solid var(--border)" : "none",
															background: isSelected ? "var(--accent-dim)" : "transparent",
														}}
														onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-3)"; }}
														onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
													>
														<div className="flex-1 min-w-0">
															<p className="text-sm truncate" style={{ color: "var(--text)" }}>{p.title || p.id}</p>
															<p className="text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>
																<span
																	style={{ color: p.status === "posted" ? "var(--green)" : p.status === "scheduled" ? "var(--accent)" : "var(--text-3)" }}
																>
																	{p.status}
																</span>
																{scheduledLabel && <span> · {scheduledLabel}</span>}
															</p>
														</div>
														{isSelected && <Check size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
													</div>
												);
											});
										})()}
									</div>
								)}

								<p className="text-[11px] mt-2" style={{ color: "var(--text-3)" }}>
									The reply will be chained to the selected post's tweet ID once it has been published.
								</p>
							</div>
						)}
					</div>

					<textarea
						value={post.content?.[0]?.text || ""}
						onChange={e => updateContent(0, { text: e.target.value })}
						placeholder="Write your reply…"
						rows={10}
						disabled={isPosted}
						className="textarea-field"
						style={{ width: "100%" }}
					/>
				</div>
			)}

					{/* ── Images ── */}
					{images.length > 0 && (
						<div className="flex flex-wrap gap-2 mt-5">
							{images.map(img => (
								<div
									key={img.id}
									className="relative group w-20 h-20 rounded-xl overflow-hidden"
									style={{ border: "1px solid var(--border)" }}
								>
									<SecureImage
										fileId={img.file_id}
										fallbackUrl={img.url}
										alt={img.filename}
										className="w-full h-full object-cover"
									/>
									{!isPosted && (
										<button
											type="button"
											onClick={async () => {
												try { await api.deletePostImage(postId, img.id); } catch { /* silent */ }
												setImages(prev => prev.filter(i => i.id !== img.id));
											}}
											className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
											style={{ background: "rgba(0,0,0,0.65)" }}
										>
											<X size={14} style={{ color: "white" }} />
										</button>
									)}
								</div>
							))}
						</div>
					)}

					{/* Image upload button */}
					{!isPosted && (
						<div className="mt-4">
							<input
								ref={imgInputRef}
								type="file"
								accept="image/*"
								multiple
								className="hidden"
								onChange={e => { handleImageFiles(e.target.files); e.target.value = ""; }}
							/>
							<button
								type="button"
								onClick={() => imgInputRef.current?.click()}
								disabled={uploadingImg}
								className="flex items-center gap-2 text-sm transition-colors"
								style={{ color: "var(--text-3)" }}
								onMouseEnter={e => e.currentTarget.style.color = "var(--text-2)"}
								onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}
							>
								{uploadingImg
									? <Loader size={13} className="animate-spin" />
									: <ImageIcon size={13} />}
								{uploadingImg ? "Uploading…" : "Attach images"}
							</button>
						</div>
					)}
				</div>
			</div>

			{/* ════════════════════════════════
			    RIGHT — Publish sidebar
			    ════════════════════════════════ */}
			<div
				className="w-64 shrink-0 flex flex-col h-full overflow-hidden"
				style={{ background: "var(--bg-2)" }}
			>
				<div className="flex-1 overflow-y-auto p-5 space-y-6">

					{/* ── When ── */}
					<section>
						<p className="sidebar-label">When</p>
						<div className="space-y-0.5">
							{[
								{ id: "now",    label: "Publish now",           icon: Send    },
								{ id: "fixed",  label: "Exact date & time",      icon: Clock   },
								{ id: "random", label: "Random in a window",     icon: Shuffle },
							].map(({ id, label }) => (
								<label
									key={id}
									className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer select-none transition-all"
									style={{ background: scheduleMode === id ? "rgba(168,230,61,0.06)" : "transparent" }}
									onMouseEnter={e => { if (scheduleMode !== id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
									onMouseLeave={e => { e.currentTarget.style.background = scheduleMode === id ? "rgba(168,230,61,0.06)" : "transparent"; }}
								>
									<span
										className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all"
										style={{ borderColor: scheduleMode === id ? "var(--accent)" : "var(--border-2)" }}
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
							<div className="mt-2.5 ml-2.5">
								<input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="input-field text-sm" />
							</div>
						)}
						{scheduleMode === "random" && (
							<div className="mt-2.5 ml-2.5 grid grid-cols-2 gap-2">
								<div>
									<p className="text-[10px] mb-1" style={{ color: "var(--text-3)" }}>From</p>
									<input type="time" value={windowStart} onChange={e => setWindowStart(e.target.value)} className="input-field text-sm" />
								</div>
								<div>
									<p className="text-[10px] mb-1" style={{ color: "var(--text-3)" }}>Until</p>
									<input type="time" value={windowEnd} onChange={e => setWindowEnd(e.target.value)} className="input-field text-sm" />
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
							onChange={e => setMeta("tags", e.target.value.split(",").map(t => t.trim()).filter(Boolean))}
							placeholder="react, tips, oss…"
							className="input-field text-sm"
						/>
					</section>

					{/* ── Notes ── */}
					<section>
						<button
							type="button"
							onClick={() => setShowNotes(n => !n)}
							className="sidebar-label flex items-center gap-1.5 w-full text-left transition-colors"
							style={{ color: showNotes ? "var(--text-2)" : "var(--text-3)" }}
						>
							Notes
							<span className="text-[8px] ml-auto">{showNotes ? "▲" : "▼"}</span>
						</button>
						{showNotes && (
							<textarea
								value={post.metadata?.notes || ""}
								onChange={e => setMeta("notes", e.target.value)}
								placeholder="Internal notes — not published…"
								rows={3}
								className="input-field text-sm mt-2 resize-none"
							/>
						)}
					</section>
				</div>

				{/* ── Sticky action footer ── */}
				<div className="p-4 space-y-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
					{allPublished ? (
						<>
							<p className="text-[11px] text-center pb-1" style={{ color: "var(--text-3)" }}>Published to all connected platforms.</p>
							<button type="button" onClick={() => navigate("/library")} className="btn-ghost w-full justify-center">
								Back to Posts
							</button>
						</>
					) : isPosted ? (
						<button type="button" onClick={() => navigate("/library")} className="btn-ghost w-full justify-center">
							Back to Posts
						</button>
					) : (
						<>
							<button
								type="button"
								onClick={handlePublish}
								disabled={publishing || discarding}
								className="btn-primary w-full justify-center"
							>
								{publishing ? <Loader size={14} className="animate-spin" /> : publishIcon}
								{publishLabel}
							</button>
							<button
								type="button"
								onClick={handleDiscard}
								disabled={publishing || discarding}
								className="btn-ghost w-full justify-center"
								style={{ borderColor: "var(--border-2)" }}
								onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(248,113,113,0.4)"; e.currentTarget.style.color = "var(--red)"; }}
								onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-2)"; e.currentTarget.style.color = ""; }}
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
