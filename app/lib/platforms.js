import { getPlatformCatalog, dryRunPlatformPlan } from "../../service/platforms/adapters.js";
import {
	seedPlatformsIfMissing,
	listPlatforms,
	updatePlatform,
	listPlatformAccounts,
	createPlatformAccount,
	updatePlatformAccount,
	deletePlatformAccount,
	createPublishJob,
	listPublishJobs,
} from "../../service/store/platform-store.js";
import { getPost, listPostContent, listPostImages } from "../../service/store/db-posts.js";
import { getFileFromHub } from "../../service/posting/sqlite-hub-upload.js";
import { json } from "./http.js";

async function buildCanonicalPost(postId) {
	const post = await getPost(postId);
	if (!post) throw new Error("Post not found");
	const [contentRows, images] = await Promise.all([listPostContent(postId), listPostImages(postId)]);
	const content = await Promise.all(
		(contentRows || []).map(async (row) => {
			let text = row.text || "";
			if (row.text_file_id) {
				try {
					const file = await getFileFromHub(row.text_file_id);
					if (file?.buffer) text = file.buffer.toString("utf8");
				} catch {
					// Keep the stored text if the file cannot be resolved.
				}
			}
			return { id: row.id, sequence: row.sequence, text, reply_to_tweet_id: row.reply_to_tweet_id || null };
		})
	);
	return {
		id: post.id,
		title: post.title,
		type: post.type,
		metadata: post.metadata || {},
		content: content.sort((a, b) => a.sequence - b.sequence),
		images: (images || []).map((img) => ({
			id: img.id,
			file_id: img.file_path,
			filename: img.filename,
			mime_type: img.mime_type,
			size: img.size,
		})),
	};
}

export async function catalogResponse() {
	await seedPlatformsIfMissing();
	return json({ success: true, platforms: getPlatformCatalog() });
}

export async function listPlatformsResponse() {
	await seedPlatformsIfMissing();
	const [platforms, accounts, catalog] = await Promise.all([
		listPlatforms(),
		listPlatformAccounts(),
		Promise.resolve(getPlatformCatalog()),
	]);
	const accountMap = accounts.reduce((acc, account) => {
		acc[account.platform_key] ||= [];
		acc[account.platform_key].push(account);
		return acc;
	}, {});
	const merged = platforms.map((platform) => ({
		...platform,
		catalog: catalog.find((item) => item.key === platform.key) || null,
		accounts: accountMap[platform.key] || [],
	}));
	return json({ success: true, platforms: merged });
}

export async function updatePlatformResponse(platformKey, body) {
	try {
		return json({ success: true, platform: await updatePlatform(platformKey, body || {}) });
	} catch (err) {
		return json({ success: false, error: err.message }, 400);
	}
}

export async function createAccountResponse(body) {
	try {
		if (!body?.platform_key || !body?.label) {
			return json({ success: false, error: "platform_key and label are required" }, 400);
		}
		return json({ success: true, account: await createPlatformAccount(body) }, 201);
	} catch (err) {
		return json({ success: false, error: err.message }, 400);
	}
}

export async function updateAccountResponse(id, body) {
	try {
		return json({ success: true, account: await updatePlatformAccount(id, body || {}) });
	} catch (err) {
		return json({ success: false, error: err.message }, 400);
	}
}

export async function deleteAccountResponse(id) {
	try {
		await deletePlatformAccount(id);
		return json({ success: true });
	} catch (err) {
		return json({ success: false, error: err.message }, 400);
	}
}

export async function listJobsResponse(request) {
	const params = request.nextUrl.searchParams;
	const jobs = await listPublishJobs({
		post_id: params.get("post_id") || undefined,
		platform_key: params.get("platform_key") || undefined,
		status: params.get("status") || undefined,
		limit: params.get("limit") || undefined,
	});
	return json({ success: true, jobs });
}

export async function planResponse(body) {
	try {
		const postId = body?.post_id;
		const targets = Array.isArray(body?.targets) ? body.targets : [];
		if (!postId || !targets.length) return json({ success: false, error: "post_id and targets are required" }, 400);

		const canonicalPost = await buildCanonicalPost(postId);
		const plans = [];
		for (const target of targets) {
			const dryRun = dryRunPlatformPlan(canonicalPost, target.platform_key);
			const job = await createPublishJob({
				post_id: postId,
				platform_key: target.platform_key,
				account_id: target.account_id || null,
				mode: target.mode || "manual",
				scheduled_at: target.scheduled_at || null,
				status: dryRun.ok ? "dry_run_ok" : "dry_run_failed",
				payload: dryRun.payload || {},
				error: dryRun.ok ? null : dryRun.errors.join("; "),
			});
			plans.push({ target, dry_run: dryRun, job });
		}
		return json({ success: true, post: canonicalPost, plans });
	} catch (err) {
		return json({ success: false, error: err.message }, 400);
	}
}
