import Link from "next/link";
import Shell from "../components/Shell.js";
import PostLibrary from "../components/PostLibrary.js";
import { loadPosts } from "../lib/data.js";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
	const posts = await loadPosts({ limit: 200 });

	return (
		<Shell>
			<header className="page-head">
				<div>
					<p className="kicker">Library</p>
					<h1>Posts</h1>
					<p className="sub">Open one to see it the way it will read on X.</p>
				</div>
				<Link href="/compose" className="btn">New post</Link>
			</header>
			<PostLibrary posts={posts} />
		</Shell>
	);
}
