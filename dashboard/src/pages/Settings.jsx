import { useState, useEffect } from "react";
import { Save, CheckCircle } from "lucide-react";
import { api } from "../api.js";
import Select from "../components/Select.jsx";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

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
				const f = (h) => h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`;
				desc += ` between ${f(s)} and ${f(e)}`;
			} else {
				const h = Number(hour);
				desc += ` at ${h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`}`;
			}
		}
		return desc;
	} catch { return expr; }
}

const TIMEZONES = [
	["Asia/Kolkata",        "Asia/Kolkata (IST, UTC+5:30)"],
	["UTC",                 "UTC (UTC+0)"],
	["Asia/Dubai",          "Asia/Dubai (GST, UTC+4)"],
	["Asia/Singapore",      "Asia/Singapore (SGT, UTC+8)"],
	["Asia/Tokyo",          "Asia/Tokyo (JST, UTC+9)"],
	["Australia/Sydney",    "Australia/Sydney (AEDT, UTC+11)"],
	["America/Los_Angeles", "America/Los_Angeles (PST, UTC-8)"],
	["America/Chicago",     "America/Chicago (CST, UTC-6)"],
	["America/New_York",    "America/New_York (EST, UTC-5)"],
	["Europe/London",       "Europe/London (GMT, UTC+0)"],
	["Europe/Paris",        "Europe/Paris (CET, UTC+1)"],
];

/* ── Components ──────────────────────────────────────────────────────────── */

function Toggle({ value, onChange }) {
	return (
		<button
			type="button"
			onClick={() => onChange(!value)}
			className="relative shrink-0 transition-all duration-200 focus:outline-none"
			style={{
				width: 40,
				height: 22,
				borderRadius: 99,
				background: value ? "var(--accent)" : "var(--bg-4)",
				border: `1px solid ${value ? "var(--accent)" : "var(--border-2)"}`,
			}}
		>
			<span
				className="absolute top-0.5 transition-transform duration-200"
				style={{
					left: 2,
					width: 16,
					height: 16,
					borderRadius: "50%",
					background: value ? "#080808" : "var(--text-3)",
					transform: value ? "translateX(18px)" : "translateX(0)",
				}}
			/>
		</button>
	);
}

function SettingRow({ label, desc, children, last }) {
	return (
		<div
			className="flex items-start justify-between gap-6 py-5"
			style={{ borderBottom: last ? "none" : "1px solid var(--border)" }}
		>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</p>
				{desc && <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{desc}</p>}
			</div>
			<div className="shrink-0 flex items-center gap-3">{children}</div>
		</div>
	);
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

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

	if (!form) {
		return (
			<div className="p-8 text-sm" style={{ color: "var(--text-3)" }}>Loading…</div>
		);
	}

	const cronDesc = cronToHuman(form.cron_schedule);

	return (
		<div className="p-8 max-w-2xl mx-auto animate-fade-up">

			{/* ── Header ── */}
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>Settings</h1>
				<p className="text-sm mt-0.5" style={{ color: "var(--text-2)" }}>
					Stored in DB — overrides environment variables at runtime.
				</p>
			</div>

			<form onSubmit={handleSave}>
				{/* ── Section: Posting ── */}
				<div className="mb-4">
					<p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--text-3)" }}>
						Posting
					</p>
					<div
						className="rounded-xl px-5"
						style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
					>
						<SettingRow
							label="Posting active"
							desc="Pause to stop all scheduled posts from firing"
						>
							<Toggle value={!form.paused} onChange={(v) => set("paused", !v)} />
							<span className="text-sm font-mono" style={{ color: !form.paused ? "var(--green)" : "var(--text-3)" }}>
								{form.paused ? "Paused" : "Active"}
							</span>
						</SettingRow>

						<SettingRow
							label="Daily post limit"
							desc="Maximum publish jobs executed per calendar day"
						>
							<input
								type="number"
								min={1}
								max={50}
								value={form.daily_limit || 10}
								onChange={(e) => set("daily_limit", e.target.value)}
								className="input-field font-mono text-center"
								style={{ width: 80 }}
							/>
						</SettingRow>

						<SettingRow
							label="Timezone"
							desc="Used for posting window checks and daily limit resets"
							last
						>
							<Select
								value={form.timezone || "UTC"}
								onChange={(v) => set("timezone", v)}
								options={TIMEZONES}
								className="w-72"
							/>
						</SettingRow>
					</div>
				</div>

				{/* ── Section: Scheduler ── */}
				<div className="mb-8">
					<p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--text-3)" }}>
						Scheduler
					</p>
					<div
						className="rounded-xl px-5"
						style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
					>
						<SettingRow
							label="Cron scheduler"
							desc={cronDesc || "6-field node-cron: sec min hr day month weekday"}
							last
						>
							<Toggle value={!!form.cron_enabled} onChange={(v) => set("cron_enabled", v)} />
							<input
								type="text"
								value={form.cron_schedule || ""}
								onChange={(e) => set("cron_schedule", e.target.value)}
								className="input-field font-mono text-sm"
								style={{ width: 160 }}
								placeholder="0 0 9-20 * * *"
							/>
						</SettingRow>
					</div>
					{cronDesc && (
						<p className="text-xs mt-2 ml-1 font-mono" style={{ color: "var(--text-3)" }}>
							→ {cronDesc}
						</p>
					)}
				</div>

				{/* ── Save ── */}
				<div className="flex items-center gap-3">
					<button type="submit" disabled={saving} className="btn-primary">
						{saved ? <CheckCircle size={14} /> : <Save size={14} />}
						{saved ? "Saved!" : saving ? "Saving…" : "Save Settings"}
					</button>
					{saved && (
						<span className="text-xs font-mono" style={{ color: "var(--green)" }}>
							Changes saved.
						</span>
					)}
				</div>
			</form>
		</div>
	);
}
