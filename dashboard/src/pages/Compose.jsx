import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, Loader, Send, Clock, ArrowLeft, Trash2, Shuffle, Check, Image as ImageIcon, Upload } from "lucide-react";
import { api } from "../api.js";
import ThreadBuilder from "../components/ThreadBuilder.jsx";
import { SecureImage } from "../components/SecureImage.jsx";

/* ── Platform config ─────────────────────────────────────────────────────── */
const PLATFORMS = [
	{ key: "twitter",  label: "X / Twitter", color: "#60a5fa", charLimit: 280    },
	{ key: "threads",  label: "Threads",      color: "#a78bfa", charLimit: 500    },
	{ key: "linkedin", label: "LinkedIn",     color: "#38bdf8", charLimit: 3000   },
	{ key: "reddit",   label: "Reddit",       color: "#fb923c", charLimit: 40000  },
	{ key: "devto",    label: "Dev.to",       color: "#a3e635", charLimit: 100000 },
	{ key: "bluesky",  label: "Bluesky",      color: "#67e8f9", charLimit: 300    },
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

	const saveTimerRef    = useRef(null);
	const postRef         = useRef(null);
	const postIdRef       = useRef(postId);
	const contentIdMapRef = useRef({});
	const imgInputRef     = useRef(null);

	useEffect(() => { postRef.current = post; }, [post]);
	useEffect(() => { postIdRef.current = postId; }, [postId]);

	/* ── Init ── */
	useEffect(() => {
		loadPlatforms();
		if (postId) {
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
					enabled:     !!p.enabled,
					auth_status: p.auth_status,
					// Store custom char limit from config (set in Platforms page)
					charLimit:   p.config?.charLimit ?? null,
				};
			}
			setPlatformStatuses(map);
		} catch { /* silent */ }
	};

	// Resolve the effective char limit for a platform:
	// 1. Custom limit saved in platform config  2. Hardcoded default  3. Infinity
	const getCharLimit = (key) => {
		const custom = platformStatuses[key]?.charLimit;
		if (custom != null && custom > 0) return custom;
		return PLATFORMS.find(p => p.key === key)?.charLimit ?? Infinity;
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
				? content.map(c => ({ id: c.id, text: c.text || "", media_ids: c.media_ids || [], sequence: c.sequence || 1 }))
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
				if (dbId) {
					await api.updatePostContent(id, dbId, { text: c.text, media_ids: c.media_ids || [], sequence: c.sequence });
				} else {
					const res = await api.addPostContent(id, { text: c.text, media_ids: c.media_ids || [], sequence: c.sequence });
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

	const charCount = post?.content?.[0]?.text?.length || 0;
	const tightestLimit = selectedPlatforms.length > 0
		? Math.min(...selectedPlatforms.map(k => getCharLimit(k)))
		: null;
	const finiteLimit = tightestLimit !== Infinity ? tightestLimit : null;
	const charOver = finiteLimit && charCount > finiteLimit;
	const charWarn = finiteLimit && !charOver && charCount > finiteLimit * 0.85;

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
				{/* Show tightest char limit hint */}
				{finiteLimit && (
					<span
						className="ml-auto text-xs font-mono shrink-0"
						style={{ color: "var(--text-3)" }}
					>
						limit: {finiteLimit.toLocaleString()} chars
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
								<span
									className="ml-auto text-xs font-mono"
									style={{ color: charOver ? "var(--red)" : charWarn ? "var(--amber)" : "var(--text-3)" }}
								>
							{charCount}{finiteLimit ? ` / ${finiteLimit.toLocaleString()}` : ""}
							</span>
						</div>
					</>
				)}

				{/* ── Thread ── */}
				{post.type === "thread" && (
					<ThreadBuilder
						content={post.content || []}
						onUpdate={updated => set("content", updated)}
						charLimit={finiteLimit ?? Infinity}
					/>
				)}

					{/* ── Reply ── */}
					{post.type === "reply" && (
						<div className="space-y-4">
							<div>
								<p className="text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--text-3)" }}>
									Reply to (tweet URL or ID)
								</p>
								<input
									type="text"
									value={post.content?.[0]?.reply_to_tweet_id || ""}
									onChange={e => updateContent(0, { reply_to_tweet_id: e.target.value })}
									placeholder="https://x.com/user/status/…"
									className="input-field"
									disabled={isPosted}
								/>
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
						<p className="text-xs font-mono" style={{ color: charOver ? "var(--red)" : charWarn ? "var(--amber)" : "var(--text-3)" }}>
							{charCount}{finiteLimit ? ` / ${finiteLimit.toLocaleString()}` : ""}
						</p>
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
