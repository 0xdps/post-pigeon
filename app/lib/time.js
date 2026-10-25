export function zonedTimeToUtc(value, timeZone) {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
	if (!match) return null;
	const [, year, month, day, hour, minute] = match.map(Number);
	const desired = Date.UTC(year, month - 1, day, hour, minute);
	const offset = zoneOffset(desired, timeZone);
	let utc = desired - offset;
	const corrected = zoneOffset(utc, timeZone);
	if (corrected !== offset) utc -= corrected - offset;
	return utc;
}

function zoneOffset(utcMs, timeZone) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(new Date(utcMs));
	const pick = (type) => Number(parts.find((part) => part.type === type).value);
	const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"), pick("second"));
	return asUtc - utcMs;
}
