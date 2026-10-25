import Link from "next/link";
import Shell from "../components/Shell.js";
import RetryList from "../components/RetryList.js";
import { loadJobs, loadPlatforms, loadPosts, loadStats } from "../lib/data.js";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
	const [jobs, posts, stats, platforms] = await Promise.all([
		loadJobs(),
		loadPosts({ limit: 200 }),
		loadStats(),
		loadPlatforms(),
	]);
	const titles = Object.fromEntries(posts.map((post) => [post.id, post.title]));
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const postedToday = jobs.filter((job) => job.status === "posted" && job.posted_at >= start.getTime()).length;
	const upcoming = jobs
		.filter((job) => job.status === "pending")
		.sort((a, b) => (a.scheduled_at || 0) - (b.scheduled_at || 0))
		.slice(0, 6);
	const failed = jobs
		.filter((job) => job.status === "failed")
		.slice(0, 5)
		.map((job) => ({ id: job.id, title: titles[job.post_id] || job.post_id, error: job.error || "" }));

	return (
		<Shell>
			<header className="page-head">
				<div>
					<p className="kicker">Today</p>
					<h1>Overview</h1>
					<p className="sub">{postedToday} sent today</p>
				</div>
				<Link href="/compose" className="btn">Write a post</Link>
			</header>
			<div className="stats">
				<div><span>Queued</span><strong>{jobs.filter((job) => job.status === "pending").length}</strong></div>
				<div><span>Failed</span><strong>{jobs.filter((job) => job.status === "failed").length}</strong></div>
				<div><span>Drafts</span><strong>{stats?.draft || 0}</strong></div>
				<div><span>Platforms on</span><strong>{platforms.filter((platform) => platform.enabled).length}</strong></div>
			</div>
			<section className="panel" style={{ marginTop: 18 }}>
				<h2>Next up</h2>
				{upcoming.length === 0 ? <p className="save-note">Nothing queued.</p> : null}
				{upcoming.map((job) => (
					<div key={job.id} className="row">
						<span className="pill">{job.platform_key}</span>
						<span>{titles[job.post_id] || "Untitled"}</span>
						<span className="save-note">{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : "waiting"}</span>
					</div>
				))}
			</section>
			<RetryList jobs={failed} />
		</Shell>
	);
}
