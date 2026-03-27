/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,jsx}"],
	theme: {
		extend: {
			fontFamily: {
				sans: ["Syne", "sans-serif"],
				mono: ['"JetBrains Mono"', "monospace"],
			},
			colors: {
				lime: {
					400: "#a3e635",
					500: "#84cc16",
				},
				acid: "#c6f135",
			},
			keyframes: {
				"fade-in": {
					"0%": { opacity: "0", transform: "translateY(6px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
				"pulse-dot": {
					"0%, 100%": { opacity: "1" },
					"50%": { opacity: "0.3" },
				},
			},
			animation: {
				"fade-in": "fade-in 0.25s ease-out both",
				"pulse-dot": "pulse-dot 1.5s ease-in-out infinite",
			},
		},
	},
	plugins: [],
};
