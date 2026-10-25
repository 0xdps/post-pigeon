import { redirect } from "next/navigation";
import Shell from "../components/Shell.js";
import { isAuthenticated } from "../lib/session.js";

const STEPS = [
	{ name: "TWITTER_CLIENT_ID", desc: "OAuth 2.0 Client ID" },
	{ name: "TWITTER_CLIENT_SECRET", desc: "OAuth 2.0 Client Secret" },
	{ name: "TWITTER_ACCESS_TOKEN", desc: "User access token. Refreshed automatically after 2 hours." },
	{ name: "TWITTER_ACCESS_REFRESH_TOKEN", desc: "Refresh token. Lasts about 6 months." },
];

export const dynamic = "force-dynamic";

export default async function GuidePage() {
	if (!(await isAuthenticated())) redirect("/login");
	return (
		<Shell>
			<header className="page-head">
				<div>
					<p className="kicker">X</p>
					<h1>Setup</h1>
					<p className="sub">Generate the user token pair at developer.x.com, under OAuth 2.0. Permissions must be Read and Write.</p>
				</div>
			</header>
			<section className="panel" style={{ display: "grid", gap: 12, maxWidth: 720 }}>
				{STEPS.map((step) => (
					<div key={step.name} className="row">
						<code>{step.name}</code>
						<span className="save-note">{step.desc}</span>
					</div>
				))}
			</section>
		</Shell>
	);
}
