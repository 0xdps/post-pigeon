// service/poster.js
import fs from "fs/promises";
import { preparePost, postTweet } from "./post-utils.js";
import { loadBankFromDb } from "../store/db-posts.js";
import { loadState, saveState, appendPosted, getPostsToday, getNextFromQueue, removeFromQueue, getBlockedLocalIds } from "../store/state-store.js";
import config, { START_HOUR, END_HOUR } from "../core/config.js";

function isWithinPostingHours(now = new Date(), timezone = "Asia/Kolkata") {
	// Get hour in the specified timezone using Intl API
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour: "2-digit",
		hour12: false,
	});
	const parts = formatter.formatToParts(now);
	const h = Number(parts.find((p) => p.type === "hour").value);
	return h >= START_HOUR && h < END_HOUR;
}

/**
 * Starting from startCounter, find the first bank item whose id is not in blockedIds.
 * Scans up to bank.length positions (wrapping). Falls back to the current position
 * if every item is blocked (e.g. all have been posted — normal cycling resumes).
 * Returns { item, nextCounter } where nextCounter is what state.counter should become.
 */
function findNextBankItem(bank, startCounter, blockedIds) {
	const n = bank.length;
	for (let offset = 0; offset < n; offset++) {
		const idx = (startCounter + offset) % n;
		const candidate = bank[idx];
		if (!blockedIds.has(String(candidate.id))) {
			return { item: candidate, nextCounter: startCounter + offset + 1 };
		}
	}
	// All items blocked — fall back so the cron is never stuck
	const fallbackIdx = startCounter % n;
	console.log(`[poster] All bank items are blocked (queued/scheduled/posted). Falling back to counter position ${fallbackIdx}.`);
	return { item: bank[fallbackIdx], nextCounter: startCounter + 1 };
}

/**
 * @param {{ manual?: boolean, force?: boolean }} opts
 *   manual=true  → skip probability + cooldown + window checks (dashboard trigger / direct post)
 *   force=true   → also skip daily limit when manual_limit_override setting is enabled
 */
async function run({ manual = false, force = false } = {}) {
	// 0. maintenance check (file-based, always applies)
	try {
		await fs.access("MAINTENANCE");
		console.log("MAINTENANCE file found. Exiting.");
		return { skipped: true, reason: "maintenance" };
	} catch {
		// No MAINTENANCE file, continue
	}

	// 1. paused check (always applies)
	const paused = await config.isPaused();
	if (paused) {
		console.log("Posting is paused. Skipping.");
		return { skipped: true, reason: "paused" };
	}

	// 2. probability check (cron only)
	if (!manual) {
		const prob = await config.getPostProbability();
		if (prob < 1 && Math.random() > prob) {
			console.log(`Skipping due to post_probability=${prob}`);
			return { skipped: true, reason: "probability" };
		}
	}

	// 3. cooldown check (cron only)
	if (!manual) {
		const cooldownUntil = await config.getCooldownUntil();
		if (cooldownUntil && Date.now() < cooldownUntil) {
			const resumesAt = new Date(cooldownUntil).toISOString();
			console.log(`Cooldown active until ${resumesAt}. Skipping.`);
			return { skipped: true, reason: "cooldown", resumesAt };
		}
	}

	// 4. time window (cron only)
	if (!manual) {
		const timezone = await config.getTimezone();
		if (!isWithinPostingHours(new Date(), timezone)) {
			console.log("Outside posting window (09:00-21:00). Exiting.");
			return { skipped: true, reason: "window" };
		}
	}

	// 5. load bank from DB + state
	const bank = await loadBankFromDb();
	const state = await loadState();
	state.counter = state.counter || 0;

	// 6. daily limit — computed live from posted table
	const DAILY_LIMIT = await config.getDailyLimit();
	const postsToday = await getPostsToday();
	if (postsToday >= DAILY_LIMIT) {
		if (manual && force) {
			const overrideAllowed = await config.getManualLimitOverride();
			if (!overrideAllowed) {
				console.log(`Daily limit reached (${DAILY_LIMIT}) and manual_limit_override is disabled. Rejecting.`);
				return { skipped: true, reason: "limit" };
			}
			console.log(`Daily limit exceeded (${postsToday}/${DAILY_LIMIT}) but override is enabled. Proceeding.`);
		} else {
			console.log(`Daily limit reached (${DAILY_LIMIT}). Skipping.`);
			return { skipped: true, reason: "limit" };
		}
	}

	// 7. pick item — drain priority queue first, then smart bank counter
	let item = null;
	let fromQueue = false;
	let nextCounter = state.counter; // will be updated if we pick from bank

	const queueEntry = await getNextFromQueue();
	if (queueEntry) {
		const found = bank.find((b) => String(b.id) === String(queueEntry.local_id));
		if (found) {
			item = found;
			fromQueue = true;
			// NOTE: do NOT remove from queue yet — remove only after successful post
			console.log(`Using queued item: ${queueEntry.local_id}`);
		} else {
			// Stale queue entry (bank item removed), discard and fall through
			await removeFromQueue(queueEntry.id);
			console.log(`Stale queue entry ${queueEntry.local_id} removed.`);
		}
	}

	if (!item) {
		// Build blocked set: anything currently queued, pending scheduled, or already posted
		// Single UNION query instead of three separate round-trips
		const blockedIds = await getBlockedLocalIds();

		const picked = findNextBankItem(bank, state.counter, blockedIds);
		item = picked.item;
		nextCounter = picked.nextCounter;
		console.log(`Using bank item: ${item.id} (counter ${state.counter} → ${nextCounter})`);
	}

	// 8. set cooldown EARLY (before random delay and posting)
	const cooldownMins = await config.getCooldownMinutes();
	const cooldownUntil = Date.now() + cooldownMins * 60 * 1000;
	await config.setCooldownUntil(cooldownUntil);
	console.log(`Cooldown set for ${cooldownMins}m (until ${new Date(cooldownUntil).toISOString()})`);

	// 9. apply random delay (after cooldown is set)
	const randomDelayMinutes = await config.getRandomDelayMinutes();
	if (randomDelayMinutes > 0) {
		const delayMs = Math.floor(Math.random() * randomDelayMinutes * 60 * 1000);
		const delayMinutes = (delayMs / 60000).toFixed(2);
		console.log(`[posting] Random delay: ${delayMinutes} minutes before post`);
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	// 10. prepare and post
	const { text, mediaIds, client } = await preparePost(item, state.counter);
	const tweetId = await postTweet(text, mediaIds, client);

	// 11. update state (only after successful post)
	// Remove from queue now that the post succeeded
	if (fromQueue) await removeFromQueue(queueEntry.id);
	await appendPosted({ localId: item.id, tweetId, ts: Date.now(), triggerType: "queued" });
	if (!fromQueue) state.counter = nextCounter;

	await saveState(state);
	console.log(`Posted tweet ${tweetId}. Today count: ${postsToday + 1}/${DAILY_LIMIT}`);

	return { skipped: false, tweetId, localId: item.id, fromQueue };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	run({ manual: true })
		.then((r) => {
			if (r && r.skipped) process.exit(0);
			process.exit(0);
		})
		.catch((err) => {
			console.error("Fatal error in poster:", err);
			process.exit(1);
		});
}

export default run;
