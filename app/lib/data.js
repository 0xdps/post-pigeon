import { redirect } from "next/navigation";
import { isAuthenticated } from "./session.js";
import { listPosts, getPost, getPostStats, listPostContent, listPostImages } from "../../service/store/db-posts.js";
import { listPublishJobs } from "../../service/store/publish-jobs.js";
import { seedPlatformsIfMissing, listPlatforms, listPlatformAccounts } from "../../service/store/platform-store.js";
import { getPlatformCatalog } from "../../service/platforms/adapters.js";
import { getFileFromHub } from "../../service/posting/sqlite-hub-upload.js";
import { createClient } from "../../service/posting/twitter-client.js";
import config from "../../service/core/config.js";

export async function requirePage() {
	if (!(await isAuthenticated())) redirect("/login");
}

export async function loadPosts({ status, limit = 100 } = {}) {
	await requirePage();
	return listPosts(
		{ status: status || undefined },
		{ limit, offset: 0, orderBy: "updated_at DESC" }
	);
}

export async function loadPost(id) {
	await requirePage();
	const post = await getPost(id);
	if (!post) return null;
	const [contentRows, images] = await Promise.all([listPostContent(id), listPostImages(id)]);
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
			return { ...row, text };
		})
	);
	return { ...post, content, images: images || [] };
}

export async function loadJobs() {
	await requirePage();
	return listPublishJobs({});
}

export async function loadStats() {
	await requirePage();
	return getPostStats();
}

export async function loadPlatforms() {
	await requirePage();
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
	return platforms.map((platform) => ({
		...platform,
		catalog: catalog.find((item) => item.key === platform.key) || null,
		accounts: accountMap[platform.key] || [],
	}));
}

export async function loadSettings() {
	await requirePage();
	return config.getAllSettings();
}

let accountCache = { value: null, at: 0 };

export async function loadTwitterAccount() {
	await requirePage();
	if (accountCache.value && Date.now() - accountCache.at < 10 * 60 * 1000) return accountCache.value;
	try {
		const client = await createClient();
		const res = await client.v2.me();
		accountCache = {
			value: { id: res?.data?.id, username: res?.data?.username, name: res?.data?.name },
			at: Date.now(),
		};
		return accountCache.value;
	} catch (err) {
		console.warn("[twitter] Account lookup skipped:", err?.message || err);
		return accountCache.value;
	}
}
