import { useEffect, useState } from "react";
import { Layers3, RefreshCw } from "lucide-react";
import { api } from "../api.js";

export default function Platforms() {
	const [platforms, setPlatforms] = useState([]);
	const [loading, setLoading]     = useState(true);
	const [saving, setSaving]       = useState(false);
	const [error, setError]         = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await api.getPlatforms();
			setPlatforms(res?.platforms || []);
		} catch (err) {
			setError(err.message || "Failed to load");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, []);

	const togglePlatform = async (platform) => {
		setSaving(true);
		try {
			await api.updatePlatform(platform.key, { enabled: !platform.enabled });
			await load();
		} finally {
			setSaving(false);
		}
	};

	if (loading) return <div className="p-8 text-sm text-zinc-600">Loading…</div>;

	return (
		<div className="p-8 max-w-3xl">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold">Platforms</h1>
					<p className="text-zinc-500 text-sm mt-0.5">Enable platforms you post to.</p>
				</div>
				<button type="button" onClick={load} className="btn-ghost border border-[#252525]" disabled={saving}>
					<RefreshCw size={14} /> Refresh
				</button>
			</div>

			{error && (
				<div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">
					{error}
				</div>
			)}

			<div className="space-y-3">
				{platforms.map((platform) => (
					<div key={platform.key} className="card rounded-xl p-4">
						<div className="flex items-start justify-between gap-4 mb-3">
							<div>
								<div className="flex items-center gap-2">
									<Layers3 size={14} className="text-sky-500" />
									<h2 className="text-sm font-medium text-zinc-100">{platform.name}</h2>
								</div>
								<p className="text-xs text-zinc-500 mt-1 font-mono">{platform.key}</p>
							</div>
							<button
								type="button"
								onClick={() => togglePlatform(platform)}
								disabled={saving}
								className={`px-3 py-1 rounded-md text-xs border transition-colors ${
									platform.enabled
										? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
										: "border-[#252525] bg-[#1c1c1c] text-zinc-400"
								}`}
							>
								{platform.enabled ? "Enabled" : "Disabled"}
							</button>
						</div>

						<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
							<Capability label="Max chars"   value={platform.catalog?.capabilities?.maxCharacters} />
							<Capability label="Thread"      value={platform.catalog?.capabilities?.supportsThread ? "Yes" : "No"} />
							<Capability label="Images"      value={platform.catalog?.capabilities?.supportsImages ? "Yes" : "No"} />
							<Capability label="Max images"  value={platform.catalog?.capabilities?.maxImagesPerPost} />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function Capability({ label, value }) {
	return (
		<div className="rounded-md border border-[#252525] bg-[#161616] px-2 py-1.5">
			<p className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
			<p className="text-xs text-zinc-300 mt-0.5">{value ?? "—"}</p>
		</div>
	);
}
