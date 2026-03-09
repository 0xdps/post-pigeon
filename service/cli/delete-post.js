/**
 * service/delete-post.js
 * Usage: node service/delete-post.js <local-post-id>
 *
 * Reads state.json, finds the entry with localId, deletes the tweet via Twitter API,
 * removes the entry from state.json and writes the file.
 *
 * The workflow will commit & push state.json back to main.
 */

import fs from "fs/promises";
import { createClient, deleteStatus } from "../posting/twitter-client.js";

const [, , localIdArg] = process.argv;

if (!localIdArg) {
	console.error("Usage: node service/delete-post.js <local-post-id>");
	process.exit(2);
}

const LOCAL_ID = localIdArg;
const STATE_FILE = process.env.STATE_PATH || "state.json";

async function loadState() {
	try {
		const raw = await fs.readFile(STATE_FILE, "utf8");
		return JSON.parse(raw);
	} catch (e) {
		return { counter: 0, posted: [] };
	}
}

async function saveState(state) {
	await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function main() {
	const state = await loadState();
	if (!Array.isArray(state.posted)) state.posted = [];

	const idx = state.posted.findIndex((p) => String(p.localId) === String(LOCAL_ID));
	if (idx === -1) {
		console.log(`No posted entry found for localId "${LOCAL_ID}". Nothing to delete.`);
		process.exit(0);
	}

	const entry = state.posted[idx];
	const tweetId = entry.tweetId || entry.tweet_id;
	if (!tweetId) {
		console.error("Found entry but no tweetId present:", entry);
		process.exit(1);
	}

	const client = createClient();

	try {
		console.log(`Deleting tweet ${tweetId} for localId ${LOCAL_ID}...`);
		await deleteStatus(client, tweetId);

		console.log("Deleted tweet on Twitter.");
		// remove entry and save state
		state.posted.splice(idx, 1);
		await saveState(state);
		console.log("Updated state.json (removed entry).");
		process.exit(0);
	} catch (err) {
		console.error("Error deleting tweet:", err);
		process.exit(1);
	}
}

main();
