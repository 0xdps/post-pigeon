import Shell from "../../components/Shell.js";
import Composer from "../../components/Composer.js";
import { loadPlatforms, loadPost, loadSettings, loadTwitterAccount } from "../../lib/data.js";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }) {
	const { id } = await params;
	const [post, account, settings, platforms] = await Promise.all([
		loadPost(id),
		loadTwitterAccount(),
		loadSettings(),
		loadPlatforms(),
	]);

	return (
		<Shell>
			{post ? <Composer initialPost={post} account={account} platforms={platforms} timezone={settings.timezone || "Asia/Kolkata"} maxLength={settings.max_tweet_length || 280} /> : <p style={{ color: "var(--danger)" }}>Post not found</p>}
		</Shell>
	);
}
