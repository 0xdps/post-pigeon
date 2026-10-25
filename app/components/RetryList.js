"use client";

import { useRouter } from "next/navigation";
import { api } from "../lib/client.js";

export default function RetryList({ jobs }) {
	const router = useRouter();
	if (!jobs.length) return null;

	return (
		<section className="panel" style={{ marginTop: 14 }}>
			<h2>Needs another try</h2>
			{jobs.map((job) => (
				<div key={job.id} className="row">
					<span>{job.title}</span>
					<span className="save-note">{job.error || ""}</span>
					<button
						type="button"
						className="btn-ghost"
						onClick={async () => {
							await api.publishJob(job.id);
							router.refresh();
						}}
					>
						Retry
					</button>
				</div>
			))}
		</section>
	);
}
