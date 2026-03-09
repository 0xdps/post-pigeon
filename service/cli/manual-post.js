/**
 * service/manual-post.js
 * Usage:
 *   node service/manual-post.js <optional-local-post-id>
 *
 * If local-post-id is provided, posts that item immediately.
 * Otherwise uses state.counter % bank.length.
 *
 * On success it appends { localId, tweetId, ts } to state.posted and increments counter (if not manual id).
 * Writes state.json; workflow will commit & push the updated state.
 */

import fs from "fs/promises";
import { preparePost, postTweet } from "../posting/post-utils.js";
import { loadBankFromDb, getBankItemFromDb } from "../store/db-posts.js";
import { initDb } from "../core/db.js";

const [, , localIdArg] = process.argv;
const STATE_FILE = process.env.STATE_PATH || "state.json";

async function loadJSON(p, fallback) {
	try {
		const s = await fs.readFile(p, "utf8");
		return JSON.parse(s);
	} catch {
		return fallback;
	}
}

async function saveJSON(p, data) {
	await fs.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
	await initDb();
	const bank = await loadBankFromDb();
	const state = await loadJSON(STATE_FILE, { counter: 0, posted: [] });

	let item;
	let usedCounter = false;

	if (localIdArg) {
		item = await getBankItemFromDb(localIdArg);
		if (!item) {
			console.error(`Bank item not found: ${localIdArg}`);
			process.exit(1);
		}
	} else {
		const idx = state.counter % bank.length;
		item = bank[idx];
		usedCounter = true;
	}

	try {
		const { text, mediaIds, client } = await preparePost(item, state.counter || 0);
		const tweetId = await postTweet(text, mediaIds, client);

		state.posted = state.posted || [];
		state.posted.push({ localId: item.id, tweetId, ts: Date.now() });

		if (usedCounter) {
			state.counter = (state.counter || 0) + 1;
		}

		await saveJSON(STATE_FILE, state);
		console.log("Updated state.json");
		process.exit(0);
	} catch (err) {
		console.error("Error posting tweet:", err);
		process.exit(1);
	}
}

main();
