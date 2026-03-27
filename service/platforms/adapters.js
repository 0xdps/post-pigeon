export const PLATFORM_CATALOG = [
	{
		key: "twitter",
		name: "X / Twitter",
		capabilities: {
			maxCharacters: 1400,
			supportsThread: true,
			supportsImages: true,
			maxImagesPerPost: 4,
		},
	},
	{
		key: "linkedin",
		name: "LinkedIn",
		capabilities: {
			maxCharacters: 3000,
			supportsThread: false,
			supportsImages: true,
			maxImagesPerPost: 20,
		},
	},
	{
		key: "reddit",
		name: "Reddit",
		capabilities: {
			maxCharacters: 40000,
			supportsThread: false,
			supportsImages: true,
			maxImagesPerPost: 20,
		},
	},
	{
		key: "threads",
		name: "Threads",
		capabilities: {
			maxCharacters: 500,
			supportsThread: false,
			supportsImages: true,
			maxImagesPerPost: 10,
		},
	},
	{
		key: "devto",
		name: "Dev.to",
		capabilities: {
			maxCharacters: 100000,
			supportsThread: false,
			supportsImages: true,
			maxImagesPerPost: 100,
		},
	},
];

function validateAgainstCapabilities(post, platform) {
	const errors = [];
	const warnings = [];
	const caps = platform.capabilities;
	const content = Array.isArray(post.content) ? post.content : [];
	const images = Array.isArray(post.images) ? post.images : [];

	if (!caps.supportsThread && content.length > 1) {
		errors.push("This platform does not support thread-style multi-part posts.");
	}

	if (!caps.supportsImages && images.length > 0) {
		errors.push("This platform does not support image attachments.");
	}

	if (caps.supportsImages && typeof caps.maxImagesPerPost === "number" && images.length > caps.maxImagesPerPost) {
		errors.push(`Too many images for ${platform.name}. Max allowed: ${caps.maxImagesPerPost}.`);
	}

	for (const [idx, part] of content.entries()) {
		const text = (part?.text || "").trim();
		if (!text) {
			warnings.push(`Part ${idx + 1} has empty text.`);
			continue;
		}
		if (text.length > caps.maxCharacters) {
			errors.push(`Part ${idx + 1} exceeds max length (${text.length}/${caps.maxCharacters}).`);
		}
	}

	return {
		ok: errors.length === 0,
		errors,
		warnings,
	};
}

export function getPlatformCatalog() {
	return PLATFORM_CATALOG;
}

export function getPlatformByKey(platformKey) {
	return PLATFORM_CATALOG.find((p) => p.key === platformKey) || null;
}

export function dryRunPlatformPlan(post, platformKey) {
	const platform = getPlatformByKey(platformKey);
	if (!platform) {
		return {
			ok: false,
			errors: [`Unknown platform: ${platformKey}`],
			warnings: [],
			payload: null,
		};
	}

	const validation = validateAgainstCapabilities(post, platform);

	return {
		platform_key: platform.key,
		platform_name: platform.name,
		ok: validation.ok,
		errors: validation.errors,
		warnings: validation.warnings,
		payload: {
			title: post.title,
			type: post.type,
			parts: (post.content || []).map((part, idx) => ({
				index: idx + 1,
				text: part.text,
			})),
			image_count: (post.images || []).length,
			meta: post.metadata || {},
		},
	};
}
