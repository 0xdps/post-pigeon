import Shell from "../components/Shell.js";
import Timeline from "../components/Timeline.js";
import { loadJobs, loadPosts } from "../lib/data.js";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
	const [jobs, posts] = await Promise.all([loadJobs(), loadPosts({ limit: 300 })]);
	const titles = Object.fromEntries(posts.map((post) => [post.id, post.title]));

	return (
		<Shell>
			<header className="page-head">
				<div>
					<p className="kicker">Deliveries</p>
					<h1>Timeline</h1>
					<p className="sub">Every scheduled send, grouped by the post it belongs to.</p>
				</div>
			</header>
			<Timeline jobs={jobs} titles={titles} />
		</Shell>
	);
}
