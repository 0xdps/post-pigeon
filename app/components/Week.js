"use client";

import Link from "next/link";

function startOfWeek(date) {
	const copy = new Date(date);
	const day = copy.getDay();
	copy.setHours(0, 0, 0, 0);
	copy.setDate(copy.getDate() - day);
	return copy;
}

export default function Week({ jobs, titles }) {
	const start = startOfWeek(new Date());
	const days = Array.from({ length: 7 }, (_, index) => {
		const date = new Date(start);
		date.setDate(start.getDate() + index);
		return date;
	});

	return (
		<div className="week">
			{days.map((day) => {
				const next = new Date(day);
				next.setDate(day.getDate() + 1);
				const slots = jobs.filter((job) => {
					const at = job.scheduled_at || job.posted_at;
					return at && at >= day.getTime() && at < next.getTime();
				});
				return (
					<section key={day.toISOString()} className="day">
						<strong>{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</strong>
						{slots.map((job) => (
							<Link key={job.id} href={`/compose/${job.post_id}`} className="slot">
								{new Date(job.scheduled_at || job.posted_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
								<span>{job.platform_key} · {titles[job.post_id] || "Untitled"}</span>
							</Link>
						))}
					</section>
				);
			})}
		</div>
	);
}
