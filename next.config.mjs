/** @type {import('next').NextConfig} */
const nextConfig = {
	output: "standalone",
	outputFileTracingIncludes: {
		"*": ["./service/**/*"],
	},
	serverExternalPackages: ["twitter-api-v2", "@mesahub/client", "node-cron"],
	webpack: (config, { isServer }) => {
		if (isServer) config.resolve.fallback = { ...config.resolve.fallback, crypto: false };
		return config;
	},
	experimental: {
		serverActions: {
			bodySizeLimit: "25mb",
		},
	},
};

export default nextConfig;
