"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../lib/client.js";

const FILTERS = [
	{ id: "", label: "All" },
	{ id: "draft", label: "Drafts" },
	{ id: "scheduled", label: "Scheduled" },
	{ id: "posted", label: "Posted" },
];

export default function PostLibrary({ posts }) {
	const router = useRouter();
	const [filter, setFilter] = useState("");
	const [query, setQuery] = useState("");
	const visible = useMemo(
		() => posts.filter((post) => {
			if (filter && post.status !== filter) return false;
			if (!query.trim()) return true;
			return (post.title || "").toLowerCase().includes(query.trim().toLowerCase());
		}),
		[posts, filter, query]
	);

	async function remove(event, id) {
		event.preventDefault();
		event.stopPropagation();
		if (!window.confirm("Delete this post?")) return;
		await api.deletePost(id);
		router.refresh();
	}

	return (
		<>
			<input
				className="search"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				placeholder="Search posts"
				aria-label="Search posts"
			/>
			<div className="filters">
				{FILTERS.map((item) => (
					<button key={item.id} type="button" data-on={filter === item.id} onClick={() => setFilter(item.id)}>
						{item.label}
					</button>
				))}
			</div>
			<div className="library">
				{visible.length === 0 ? <p className="empty">Nothing here yet. Write the first post.</p> : null}
				{visible.map((post) => (
					<Link key={post.id} href={`/compose/${post.id}`} className="post-card">
						<div>
							<div className="meta">
								<span className={`pill ${post.status === "posted" ? "ok" : post.status === "scheduled" ? "warn" : ""}`}>
									{post.status || "draft"}
								</span>
								<span>{post.type === "thread" ? "Thread" : "Post"}</span>
							</div>
							<strong>{post.title || "Untitled"}</strong>
							<span className="save-note">{post.updated_at ? new Date(post.updated_at).toLocaleString() : ""}</span>
						</div>
						<span className="row">
							<button type="button" className="btn-danger" onClick={(event) => remove(event, post.id)}>Delete</button>
							<span className="save-note">Edit</span>
						</span>
					</Link>
				))}
			</div>
		</>
	);
}
