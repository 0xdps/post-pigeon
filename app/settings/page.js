import Shell from "../components/Shell.js";
import SettingsForm from "../components/SettingsForm.js";
import { loadSettings } from "../lib/data.js";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
	const settings = await loadSettings();

	return (
		<Shell>
			<header className="page-head">
				<div>
					<p className="kicker">Clock</p>
					<h1>Settings</h1>
					<p className="sub">The time you pick on a post is read in this timezone. The character limit is checked before a post is sent.</p>
				</div>
			</header>
			<SettingsForm timezone={settings.timezone || "Asia/Kolkata"} maxLength={settings.max_tweet_length || 280} />
		</Shell>
	);
}
