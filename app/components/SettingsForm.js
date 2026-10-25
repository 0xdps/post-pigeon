"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Select from "./Select.js";
import { api } from "../lib/client.js";

const TIMEZONES = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "America/Los_Angeles", "America/Chicago", "America/New_York", "Europe/London", "Europe/Paris"];

export default function SettingsForm({ timezone, maxLength }) {
	const router = useRouter();
	const [value, setValue] = useState(timezone);
	const [length, setLength] = useState(maxLength);
	const [note, setNote] = useState("");
	const [error, setError] = useState("");

	async function save(event) {
		event.preventDefault();
		setError("");
		const nextLength = Number(length);
		if (!Number.isInteger(nextLength) || nextLength < 1 || nextLength > 25000) {
			setError("Character limit must be between 1 and 25000");
			return;
		}
		const result = await api.updateSettings({ timezone: value, max_tweet_length: nextLength });
		if (result?.ok) {
			setNote("Saved");
			router.refresh();
		} else {
			setError(result?.error || "Could not save settings");
		}
	}

	return (
		<form className="panel" onSubmit={save} style={{ display: "grid", gap: 16, maxWidth: 560 }}>
			<div className="row">
				<span>Timezone</span>
				<Select label="Timezone" value={value} options={TIMEZONES} onChange={setValue} />
			</div>
			<label className="row">
				<span>X character limit</span>
				<input type="number" min="1" max="25000" value={length} onChange={(event) => setLength(event.target.value)} />
			</label>
			<p className="save-note">280 for a normal account. 25000 if the account has Premium.</p>
			<div className="row">
				<button className="btn" type="submit">Save settings</button>
				<span className="save-note">{note}</span>
			</div>
			{error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
		</form>
	);
}
