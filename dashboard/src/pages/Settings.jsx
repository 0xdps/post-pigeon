import { useState, useEffect } from "react";
import { Save, CheckCircle } from "lucide-react";
import { api } from "../api.js";
import Select from "../components/Select.jsx";

function cronToHuman(expr) {
	if (!expr) return "";
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 6) return expr;
	const [, min, hour] = parts;
	try {
		let desc = min === "0" ? "Every hour" : min.startsWith("*/") ? `Every ${min.slice(2)} minutes` : `At minute ${min}`;
		if (hour !== "*") {
			if (hour.includes("-")) {
				const [s, e] = hour.split("-").map(Number);
				const f = (h) => h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
				desc += ` between ${f(s)} and ${f(e)}`;
			} else {
				const h = Number(hour);
				desc += ` at ${h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}`;
			}
		}
		return desc;
	} catch (e) { return expr; }
}

const TIMEZONES = [
	["Asia/Kolkata",       "Asia/Kolkata (IST, UTC+5:30)"],
	["UTC",                "UTC (UTC+0)"],
	["Asia/Dubai",         "Asia/Dubai (GST, UTC+4)"],
	["Asia/Singapore",     "Asia/Singapore (SGT, UTC+8)"],
	["Asia/Tokyo",         "Asia/Tokyo (JST, UTC+9)"],
	["Australia/Sydney",   "Australia/Sydney (AEDT, UTC+11)"],
	["America/Los_Angeles","America/Los_Angeles (PST, UTC-8)"],
	["America/Chicago",    "America/Chicago (CST, UTC-6)"],
	["America/New_York",   "America/New_York (EST, UTC-5)"],
	["Europe/London",      "Europe/London (GMT, UTC+0)"],
	["Europe/Paris",       "Europe/Paris (CET, UTC+1)"],
];

function Toggle({ value, onChange }) {
	return (
		<button
			type="button"
			onClick={() => onChange(!value)}
			className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
				value ? "bg-amber-500" : "bg-zinc-700"
			}`}
		>
			<span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${value ? "translate-x-5" : ""}`} />
		</button>
	);
}

function Field({ label, desc, children }) {
	return (
		<div className="flex items-start justify-between gap-6 py-5 border-b border-[#252525] last:border-0">
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-zinc-200">{label}</p>
				{desc && <p className="text-xs text-zinc-600 mt-0.5">{desc}</p>}
			</div>
			<div className="flex-shrink-0">{children}</div>
		</div>
	);
}

export default function Settings() {
	const [form, setForm]     = useState(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved]   = useState(false);

	useEffect(() => {
		api.getSettings().then((s) => setForm(s || {}));
	}, []);

	const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

	const handleSave = async (e) => {
		e.preventDefault();
		setSaving(true);
		setSaved(false);
		await api.updateSettings({
			paused:        form.paused,
			daily_limit:   Number(form.daily_limit),
			timezone:      form.timezone,
			cron_schedule: form.cron_schedule,
			cron_enabled:  form.cron_enabled,
		});
		setSaving(false);
		setSaved(true);
		setTimeout(() => setSaved(false), 3000);
	};

	if (!form) return <div className="p-8 text-zinc-600 text-sm">Loading…</div>;

	return (
		<div className="p-8 max-w-2xl">
			<div className="mb-8">
				<h1 className="text-xl font-semibold">Settings</h1>
				<p className="text-zinc-500 text-sm mt-0.5">Stored in DB — overrides env vars at runtime.</p>
			</div>

			<form onSubmit={handleSave}>
				<div className="card rounded-xl px-4">
					<Field
						label="Posting"
						desc="Enable or disable all scheduled posts"
					>
						<div className="flex items-center gap-3">
							<Toggle value={!form.paused} onChange={(v) => set("paused", !v)} />
							<span className={`text-sm ${!form.paused ? "text-amber-400" : "text-zinc-500"}`}>
								{form.paused ? "Disabled" : "Enabled"}
							</span>
						</div>
					</Field>

					<Field
						label="Daily Post Limit"
						desc="Maximum number of posts per calendar day"
					>
						<input
							type="number"
							min={1}
							max={50}
							value={form.daily_limit || 10}
							onChange={(e) => set("daily_limit", e.target.value)}
							className="input-field font-mono w-24 text-center"
						/>
					</Field>

					<Field
						label="Timezone"
						desc="Used for posting window checks and daily limit resets"
					>
						<Select
							value={form.timezone || "UTC"}
							onChange={(v) => set("timezone", v)}
							options={TIMEZONES}
							className="w-72"
						/>
					</Field>

					<Field
						label="Scheduler"
						desc={form.cron_schedule ? cronToHuman(form.cron_schedule) : "6-field node-cron: sec min hr day month weekday"}
					>
						<div className="flex items-center gap-3">
							<Toggle value={!!form.cron_enabled} onChange={(v) => set("cron_enabled", v)} />
							<input
								type="text"
								value={form.cron_schedule || ""}
								onChange={(e) => set("cron_schedule", e.target.value)}
								className="input-field font-mono w-40 text-sm"
								placeholder="0 0 9-20 * * *"
							/>
						</div>
					</Field>
				</div>

				<div className="flex items-center gap-3 mt-6">
					<button type="submit" disabled={saving} className="btn-primary">
						{saved ? <CheckCircle size={14} /> : <Save size={14} />}
						{saved ? "Saved!" : saving ? "Saving…" : "Save Settings"}
					</button>
					{saved && <span className="text-xs text-emerald-400">Changes saved.</span>}
				</div>
			</form>
		</div>
	);
}
