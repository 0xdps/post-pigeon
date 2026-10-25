import Shell from "../components/Shell.js";
import Composer from "../components/Composer.js";
import { loadSettings, loadTwitterAccount } from "../lib/data.js";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
	const [account, settings] = await Promise.all([loadTwitterAccount(), loadSettings()]);

	return (
		<Shell>
			<Composer account={account} timezone={settings.timezone || "Asia/Kolkata"} maxLength={settings.max_tweet_length || 280} />
		</Shell>
	);
}
