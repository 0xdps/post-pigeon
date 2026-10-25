import Shell from "../../components/Shell.js";
import Composer from "../../components/Composer.js";
import { loadPost, loadSettings, loadTwitterAccount } from "../../lib/data.js";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }) {
	const { id } = await params;
	const [post, account, settings] = await Promise.all([
		loadPost(id),
		loadTwitterAccount(),
		loadSettings(),
	]);

	return (
		<Shell>
			{post ? <Composer initialPost={post} account={account} timezone={settings.timezone || "Asia/Kolkata"} maxLength={settings.max_tweet_length || 280} /> : <p style={{ color: "var(--danger)" }}>Post not found</p>}
		</Shell>
	);
}
