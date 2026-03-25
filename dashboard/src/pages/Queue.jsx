import { useState, useEffect } from "react";
import { X, Plus, ListOrdered, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../api.js";
import { SecureImage } from "../components/SecureImage.jsx";

export default function Queue() {
	const [items, setItems] = useState([]);
	const [bank, setBank] = useState([]);
	const [loading, setLoading] = useState(true);
	const [removing, setRemoving] = useState(null);
	const [input, setInput] = useState("");
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState("");
	const [expanded, setExpanded] = useState(null);
	const [search, setSearch] = useState("");

	const load = async () => {
		const [q, b] = await Promise.all([api.getQueue(), api.getBank()]);
		setItems(q || []);
		setBank(b || []);
		setLoading(false);
	};

	useEffect(() => {
		load();
	}, []);

	const bankMap = Object.fromEntries((bank || []).map((b) => [String(b.id), b]));

	const handleAdd = async (e) => {
		e.preventDefault();
		const id = input.trim();
		if (!id) return;
		if (!bankMap[id]) {
			setError(`No bank item with id "${id}"`);
			return;
		}
		setError("");
		setAdding(true);
		await api.addToQueue(id);
		setInput("");
		setAdding(false);
		load();
	};

	const handleRemove = async (id) => {
		setRemoving(id);
		await api.removeFromQueue(id);
		setRemoving(null);
		load();
	};

	if (loading) return <div className="p-8 text-zinc-600 text-sm">Loading…</div>;

	const filtered = search
		? items.filter((i) => String(i.local_id).includes(search))
		: items;

	return (
		<div className="p-8 max-w-4xl">
				<div className="mb-6">
					<h1 className="text-xl font-semibold">Priority Queue</h1>
					<p className="text-zinc-500 text-sm mt-0.5">
						Items here post before the normal bank order, first-in first-out.
					</p>
				</div>

				<input
					type="text"
					placeholder="Search by ID…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="input-field mb-6 w-full"
				/>

			{/* Add form */}
			<form onSubmit={handleAdd} className="flex gap-2 mb-8">
				<div className="flex-1">
					<input
						type="text"
						value={input}
						onChange={(e) => {
							setInput(e.target.value);
							setError("");
						}}
						placeholder="Bank item ID, e.g. 042"
						className="input-field font-mono"
					/>
					{error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
				</div>
				<button type="submit" disabled={adding || !input.trim()} className="btn-primary flex-shrink-0">
					<Plus size={14} />
					Add
				</button>
			</form>

			{/* List */}
			{items.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-zinc-700">
					<ListOrdered size={28} className="mb-3" />
					<p className="text-sm">Queue is empty — normal bank order in use.</p>
				</div>
			) : (
				<div className="space-y-1.5">
					{filtered.map((item, i) => {
						const b = bankMap[String(item.local_id)];
						const isExpanded = expanded === item.id;
						return (
							<div key={item.id} className="card rounded-xl overflow-hidden">
								<div
									className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:border-zinc-700 transition-colors"
									onClick={() => setExpanded(isExpanded ? null : item.id)}
								>
									<span className="text-sm text-zinc-700 font-mono w-5 text-center flex-shrink-0">
										{i + 1}
									</span>
									<span className="font-mono text-sm text-sky-500 w-16 flex-shrink-0">
										{item.local_id}
									</span>
									<span className="flex-1 text-sm text-zinc-500 truncate">
										{b?.text ? b.text.slice(0, 70) + (b.text.length > 70 ? "…" : "") : ""}
									</span>

									<button
										onClick={(e) => {
											e.stopPropagation();
											handleRemove(item.id);
										}}
										disabled={removing === item.id}
										className="p-1.5 rounded-md text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
									>
										<X size={13} />
									</button>

									<span className="text-zinc-700 flex-shrink-0">
										{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
									</span>
								</div>

								{isExpanded && b?.text && (
									<div className="px-4 pb-4 pt-1 border-t border-[#1a1a1a]">
										<p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono">
											{b.text}
										</p>
										{b.images?.length > 0 && (
											<div className="mt-3 flex flex-wrap gap-2">
												{b.images.map((img) => (
													<SecureImage
														key={img.id}
														fileId={img.file_id}
														fallbackUrl={img.url}
														alt={img.filename}
														className="w-32 h-32 object-cover rounded-lg border border-zinc-800"
													/>
												))}
											</div>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
