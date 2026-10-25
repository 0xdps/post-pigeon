import Shell from "../components/Shell.js";
import PlatformList from "../components/PlatformList.js";
import { loadPlatforms, loadTwitterAccount } from "../lib/data.js";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
	const platforms = await loadPlatforms();
	let account = null;
	try {
		account = await loadTwitterAccount();
	} catch {
		account = null;
	}

	return (
		<Shell>
			<header className="page-head">
				<div>
					<p className="kicker">Channels</p>
					<h1>Platforms</h1>
					<p className="sub">X is the live channel. The others stay listed so the loft is ready for them.</p>
				</div>
			</header>
			<PlatformList platforms={platforms} username={account?.username || ""} />
		</Shell>
	);
}
