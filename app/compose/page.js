import Shell from "../components/Shell.js";
import Composer from "../components/Composer.js";
import { loadPlatforms, loadSettings, loadTwitterAccount } from "../lib/data.js";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
	const [account, settings, platforms] = await Promise.all([loadTwitterAccount(), loadSettings(), loadPlatforms()]);

	return (
		<Shell>
			<Composer account={account} platforms={platforms} timezone={settings.timezone || "Asia/Kolkata"} maxLength={settings.max_tweet_length || 280} />
		</Shell>
	);
}
