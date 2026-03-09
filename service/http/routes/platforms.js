import { Hono } from "hono";
import { getPlatformCatalog, dryRunPlatformPlan } from "../../platforms/adapters.js";
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
} from "../../store/platform-store.js";
import { getPost, listPostContent, listPostImages } from "../../store/db-posts.js";
import { getFileFromHub } from "../../posting/sqlite-hub-upload.js";

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
					// Keep fallback text if direct file resolution fails
				}
			}
			return {
				id: row.id,
				sequence: row.sequence,
				text,
				reply_to_tweet_id: row.reply_to_tweet_id || null,
			};
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

export function createPlatformsRouter() {
	const router = new Hono();

	router.get("/catalog", async (c) => {
		await seedPlatformsIfMissing();
		return c.json({ success: true, platforms: getPlatformCatalog() });
	});

	router.get("/", async (c) => {
		await seedPlatformsIfMissing();
		const [platforms, accounts, catalog] = await Promise.all([
			listPlatforms(),
			listPlatformAccounts(),
			Promise.resolve(getPlatformCatalog()),
		]);

		const accountMap = accounts.reduce((acc, account) => {
			const key = account.platform_key;
			if (!acc[key]) acc[key] = [];
			acc[key].push(account);
			return acc;
		}, {});

		const merged = platforms.map((p) => ({
			...p,
			catalog: catalog.find((cItem) => cItem.key === p.key) || null,
			accounts: accountMap[p.key] || [],
		}));

		return c.json({ success: true, platforms: merged });
	});

	router.patch("/:platformKey", async (c) => {
		try {
			const platformKey = c.req.param("platformKey");
			const body = await c.req.json();
			const updated = await updatePlatform(platformKey, body || {});
			return c.json({ success: true, platform: updated });
		} catch (err) {
			return c.json({ success: false, error: err.message }, 400);
		}
	});

	router.post("/accounts", async (c) => {
		try {
			const body = await c.req.json();
			if (!body?.platform_key || !body?.label) {
				return c.json({ success: false, error: "platform_key and label are required" }, 400);
			}
			const account = await createPlatformAccount(body);
			return c.json({ success: true, account }, 201);
		} catch (err) {
			return c.json({ success: false, error: err.message }, 400);
		}
	});

	router.patch("/accounts/:id", async (c) => {
		try {
			const id = c.req.param("id");
			const body = await c.req.json();
			const account = await updatePlatformAccount(id, body || {});
			return c.json({ success: true, account });
		} catch (err) {
			return c.json({ success: false, error: err.message }, 400);
		}
	});

	router.delete("/accounts/:id", async (c) => {
		try {
			await deletePlatformAccount(c.req.param("id"));
			return c.json({ success: true });
		} catch (err) {
			return c.json({ success: false, error: err.message }, 400);
		}
	});

	router.get("/jobs", async (c) => {
		const jobs = await listPublishJobs({
			post_id: c.req.query("post_id") || undefined,
			platform_key: c.req.query("platform_key") || undefined,
			status: c.req.query("status") || undefined,
			limit: c.req.query("limit") || undefined,
		});
		return c.json({ success: true, jobs });
	});

	router.post("/plan", async (c) => {
		try {
			const body = await c.req.json();
			const postId = body?.post_id;
			const targets = Array.isArray(body?.targets) ? body.targets : [];
			if (!postId || targets.length === 0) {
				return c.json({ success: false, error: "post_id and targets are required" }, 400);
			}

			const canonicalPost = await buildCanonicalPost(postId);
			const plans = [];

			for (const target of targets) {
				const dryRun = dryRunPlatformPlan(canonicalPost, target.platform_key);
				const status = dryRun.ok ? "dry_run_ok" : "dry_run_failed";
				const error = dryRun.ok ? null : dryRun.errors.join("; ");

				const job = await createPublishJob({
					post_id: postId,
					platform_key: target.platform_key,
					account_id: target.account_id || null,
					mode: target.mode || "manual",
					scheduled_at: target.scheduled_at || null,
					status,
					payload: dryRun.payload || {},
					error,
				});

				plans.push({
					target,
					dry_run: dryRun,
					job,
				});
			}

			return c.json({ success: true, post: canonicalPost, plans });
		} catch (err) {
			return c.json({ success: false, error: err.message }, 400);
		}
	});

	return router;
}
