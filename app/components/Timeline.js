"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../lib/client.js";

const FILTERS = [
	{ id: "all", label: "All" },
	{ id: "pending", label: "Upcoming" },
	{ id: "posted", label: "Posted" },
	{ id: "failed", label: "Failed" },
];

export default function Timeline({ jobs, titles }) {
	const router = useRouter();
	const [filter, setFilter] = useState("all");
	const groups = useMemo(() => {
		const map = new Map();
		for (const job of jobs) {
			if (filter !== "all" && job.status !== filter) continue;
			const list = map.get(job.post_id) || [];
			list.push(job);
			map.set(job.post_id, list);
		}
		return [...map.entries()];
	}, [jobs, filter]);

	async function act(action, jobId) {
		await action(jobId);
		router.refresh();
	}

	return (
		<>
			<div className="filters">
				{FILTERS.map((item) => (
					<button key={item.id} type="button" data-on={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>
				))}
			</div>
			<div className="library">
				{groups.length === 0 ? <p className="empty">No deliveries match this view.</p> : null}
				{groups.map(([postId, group]) => (
					<section key={postId} className="panel">
						<div className="row">
							<strong>{titles[postId] || "Untitled post"}</strong>
							<Link href={`/compose/${postId}`} className="save-note">Edit</Link>
						</div>
						{group.map((job) => (
							<div key={job.id} className="row">
								<span className={`pill ${job.status === "posted" ? "ok" : job.status === "failed" ? "warn" : ""}`}>{job.status}</span>
								<span>{job.platform_key}</span>
								<span className="save-note">{new Date(job.posted_at || job.scheduled_at || job.created_at).toLocaleString()}</span>
								{job.status === "pending" ? <button type="button" className="btn-ghost" onClick={() => act(api.cancelJob, job.id)}>Cancel</button> : null}
								{job.status === "failed" ? <button type="button" className="btn-ghost" onClick={() => act(api.publishJob, job.id)}>Retry</button> : null}
								{job.status === "posted" && job.platform_post_id ? <a className="save-note" href={`https://x.com/i/web/status/${job.platform_post_id}`} target="_blank" rel="noreferrer">View</a> : null}
							</div>
						))}
					</section>
				))}
			</div>
		</>
	);
}
