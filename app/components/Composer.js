"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, imageSrc } from "../lib/client.js";
import { zonedTimeToUtc } from "../lib/time.js";

const blank = () => [{ key: `c-${Date.now()}`, text: "" }];

function count(text) {
	return [...(text || "")].length;
}

export default function Composer({ initialPost = null, account = null, timezone = "Asia/Kolkata", maxLength = 280 }) {
	const router = useRouter();
	const fileRef = useRef(null);
	const [postId, setPostId] = useState(initialPost?.id || null);
	const [tweets, setTweets] = useState(initialPost?.content?.length ? initialPost.content.map((item) => ({ key: item.id, id: item.id, text: item.text || "" })) : blank());
	const [images, setImages] = useState(initialPost?.images || []);
	const [when, setWhen] = useState("now");
	const [scheduledAt, setScheduledAt] = useState("");
	const [note, setNote] = useState(initialPost ? "Saved" : "");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const ids = useRef({});

	useEffect(() => {
		for (const tweet of tweets) {
			if (tweet.id) ids.current[tweet.key] = tweet.id;
		}
	}, [tweets]);

	const name = account?.name || "DPS";
	const handle = account?.username || "0xdps";
	const over = tweets.some((tweet) => count(tweet.text) > maxLength);
	const hasText = tweets.some((tweet) => tweet.text.trim());

	async function ensurePost() {
		if (postId) return postId;
		const id = `post-${Date.now()}`;
		const title = tweets[0]?.text.slice(0, 100).trim() || "Untitled";
		const created = await api.createPost({ id, type: tweets.length > 1 ? "thread" : "standalone", title });
		if (!created?.success) throw new Error(created?.error || "Could not create the post");
		setPostId(id);
		window.history.replaceState(null, "", `/compose/${id}`);
		return id;
	}

	async function persist() {
		const id = await ensurePost();
		const title = tweets[0]?.text.slice(0, 100).trim() || "Untitled";
		await api.updatePost(id, { title, type: tweets.length > 1 ? "thread" : "standalone" });
		for (const [index, tweet] of tweets.entries()) {
			if (!tweet.text.trim()) continue;
			const payload = { text: tweet.text, sequence: index + 1, media_ids: [] };
			const existing = ids.current[tweet.key];
			if (existing) {
				await api.updateContent(id, existing, payload);
			} else {
				const saved = await api.addContent(id, payload);
				if (saved?.contentId) ids.current[tweet.key] = saved.contentId;
			}
		}
		return id;
	}

	async function saveDraft() {
		setBusy(true);
		setError("");
		try {
			await persist();
			setNote("Saved");
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	}

	async function onFiles(event) {
		const files = [...event.target.files];
		event.target.value = "";
		if (!files.length) return;
		setBusy(true);
		setError("");
		try {
			const id = await ensurePost();
			const uploaded = await api.uploadImages(id, files);
			if (!uploaded?.success) throw new Error(uploaded?.error || "Image upload failed");
			const listed = await api.listImages(id);
			setImages(listed?.images || []);
			setNote("Image added");
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	}

	async function publish() {
		setBusy(true);
		setError("");
		try {
			const id = await persist();
			if (when === "later" && !scheduledAt) throw new Error("Pick a time first");
			const zoned = when === "later" ? zonedTimeToUtc(scheduledAt, timezone) : null;
			if (when === "later" && !zoned) throw new Error("Pick a valid time");
			const platform = { key: "twitter", mode: "fixed", scheduled_at: zoned || Date.now() + 60_000 };
			const scheduled = await api.createSchedule({ post_id: id, platforms: [platform] });
			if (!scheduled?.success) throw new Error(scheduled?.error || "Could not schedule the post");
			if (when === "now") {
				const jobId = scheduled.jobs?.[0]?.job_id;
				const posted = await api.publishJob(jobId);
				if (!posted?.success) throw new Error(posted?.error || "X rejected the post");
				setNote("Posted");
				router.push("/posts");
				return;
			}
			await api.updatePost(id, { status: "scheduled", scheduled_at: platform.scheduled_at });
			setNote("Scheduled");
			router.push("/posts");
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	}

	const previewCount = useMemo(() => tweets.filter((tweet) => tweet.text.trim()).length, [tweets]);

	return (
		<div className="composer">
			<section className="editor" aria-label="Post editor">
				{tweets.map((tweet, index) => (
					<div className="editor-block" key={tweet.key}>
						<div className="editor-meta">
							<span>{index === 0 ? "Post" : `Reply ${index}`}</span>
							<span className="count" data-over={count(tweet.text) > maxLength}>{count(tweet.text)} / {maxLength}</span>
						</div>
						<textarea
							value={tweet.text}
							aria-label={index === 0 ? "Post text" : `Reply ${index + 1}`}
							placeholder={index === 0 ? "Write the post" : "Write the reply"}
							onChange={(event) => {
								const next = [...tweets];
								next[index] = { ...tweet, text: event.target.value };
								setTweets(next);
								setNote("Unsaved");
							}}
						/>
						{index === 0 && images.length > 0 ? (
							<div className="editor-images">
								{images.map((image) => (
									<img key={image.id} src={imageSrc(image)} alt={image.filename || ""} />
								))}
							</div>
						) : null}
						{tweets.length > 1 ? (
							<button type="button" className="btn-ghost" onClick={() => setTweets(tweets.filter((item) => item.key !== tweet.key))}>
								Remove
							</button>
						) : null}
					</div>
				))}
				<div className="editor-bar">
					<button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>Add image</button>
					<button type="button" className="btn-ghost" onClick={() => setTweets([...tweets, { key: `c-${Date.now()}`, text: "" }])}>Add reply</button>
					<div className="choice">
						<button type="button" data-on={when === "now"} onClick={() => setWhen("now")}>Now</button>
						<button type="button" data-on={when === "later"} onClick={() => setWhen("later")}>Later</button>
					</div>
					{when === "later" ? (
						<input type="datetime-local" aria-label={`Send time in ${timezone}`} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
					) : null}
					<span className="save-note">{note}</span>
					<button type="button" className="btn-ghost" onClick={saveDraft} disabled={busy || !hasText}>Save draft</button>
					<button type="button" className="btn" onClick={publish} disabled={busy || !hasText || over}>
						{when === "later" ? "Schedule" : "Post"}
					</button>
				</div>
				{error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
				<input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" multiple hidden onChange={onFiles} />
			</section>

			<aside className="side">
				<section className="x-card" aria-label="Post preview">
					<div className="x-top">
						<span>{previewCount > 1 ? "Thread" : "Post"}</span>
						<span>Preview</span>
					</div>
					<div className="x-thread">
						{tweets.map((tweet, index) => (
							<article className="tweet" key={tweet.key}>
								<div className="rail">
									<div className="avatar" aria-hidden="true">{name.slice(0, 1)}</div>
								</div>
								<div>
									<div className="who">
										<strong>{name}</strong>
										<span>@{handle}</span>
										<span className="when">· now</span>
									</div>
									<p className="x-text">{tweet.text || (index === 0 ? "Your post will show here." : "Reply")}</p>
									{index === 0 && images.length > 0 ? (
										<div className={`media-row media-${Math.min(images.length, 4)}`}>
											{images.slice(0, 4).map((image) => (
												<img key={image.id} src={imageSrc(image)} alt={image.filename || ""} />
											))}
										</div>
									) : null}
								</div>
							</article>
						))}
					</div>
				</section>
			</aside>
		</div>
	);
}
