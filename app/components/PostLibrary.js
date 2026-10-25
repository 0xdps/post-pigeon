"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const FILTERS = [
	{ id: "", label: "All" },
	{ id: "draft", label: "Drafts" },
	{ id: "scheduled", label: "Scheduled" },
	{ id: "posted", label: "Posted" },
];

export default function PostLibrary({ posts }) {
	const [filter, setFilter] = useState("");
	const visible = useMemo(
		() => posts.filter((post) => !filter || post.status === filter),
		[posts, filter]
	);

	return (
		<>
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
						</div>
						<span className="save-note">Edit</span>
					</Link>
				))}
			</div>
		</>
	);
}
