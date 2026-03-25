import { useState, useEffect } from "react";
import { Trash2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../api.js";
import { SecureImage } from "../components/SecureImage.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";

export default function Posted() {
	const [items, setItems] = useState([]);
	const [bank, setBank] = useState([]);
	const [loading, setLoading] = useState(true);
	const [deleting, setDeleting] = useState(null);
	const [expanded, setExpanded] = useState(null);
	const [search, setSearch] = useState("");
	const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, localId: null });

	const load = async () => {
		const [data, b] = await Promise.all([api.getPosted(), api.getBank()]);
		setItems((data || []).slice().reverse());
		setBank(b || []);
		setLoading(false);
	};

	useEffect(() => {
		load();
	}, []);

	const handleDelete = (localId) => {
		setConfirmDialog({ isOpen: true, localId });
	};

	const handleConfirmDelete = async () => {
		const { localId } = confirmDialog;
		setConfirmDialog({ isOpen: false, localId: null });
		setDeleting(localId);
		await api.deletePost(localId);
		setDeleting(null);
		load();
	};

	const filtered = search
		? items.filter(
				(i) => String(i.localId).includes(search) || (i.tweetId || "").includes(search)
			)
		: items;

	if (loading) return <div className="p-8 text-zinc-600 text-sm">Loading…</div>;

	return (
		<>
		<ConfirmDialog
			isOpen={confirmDialog.isOpen}
			title="Delete Posted Item"
			message={`Delete tweet for localId "${confirmDialog.localId}" from both X and history?`}
			confirmText="Delete"
			onConfirm={handleConfirmDelete}
			onCancel={() => setConfirmDialog({ isOpen: false, localId: null })}
		/>
		<div className="p-8 max-w-4xl">
			<div className="mb-6">
				<h1 className="text-xl font-semibold">Posted History</h1>
				<p className="text-zinc-500 text-sm mt-0.5">{items.length} total posts</p>
			</div>

			<input
				type="text"
				placeholder="Search by ID or tweet ID…"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				className="input-field mb-6 w-full"
			/>

			{filtered.length === 0 ? (
				<p className="text-zinc-700 text-sm">No posts found.</p>
			) : (
				<div className="space-y-1.5">
					{items.map((post) => {
						const bankItem = bank.find((b) => String(b.id) === String(post.localId));
						const isExpanded = expanded === post.tweetId;
						return (
							<div key={post.tweetId} className="card rounded-xl overflow-hidden">
								<div
									className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:border-zinc-700 transition-colors"
									onClick={() => setExpanded(isExpanded ? null : post.tweetId)}
								>
									<span className="font-mono text-sm text-sky-500 w-16 flex-shrink-0">{post.localId}</span>
									<span className="font-mono text-xs text-zinc-600 flex-1 truncate">{post.tweetId}</span>
									<span className="text-xs text-zinc-600 flex-shrink-0">
										{new Date(post.ts).toLocaleDateString("en-US", {
											month: "short",
											day: "2-digit",
											year: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
									<div className="flex items-center gap-1 flex-shrink-0">
										<a
											href={`https://x.com/i/web/status/${post.tweetId}`}
											target="_blank"
											rel="noopener noreferrer"
											onClick={(e) => e.stopPropagation()}
											className="p-1.5 rounded-md text-zinc-700 hover:text-zinc-300 hover:bg-white/5 transition-colors"
										>
											<ExternalLink size={12} />
										</a>
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleDelete(post.localId);
											}}
											disabled={deleting === post.localId}
											className="p-1.5 rounded-md text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
										>
											<Trash2 size={12} />
										</button>
									</div>

									<span className="text-zinc-700 flex-shrink-0">
										{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
									</span>
								</div>

								{isExpanded && bankItem?.text && (
									<div className="px-4 pb-4 pt-1 border-t border-[#1a1a1a]">
										<p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono">
											{bankItem.text}
										</p>
										{bankItem.images?.length > 0 && (
											<div className="mt-3 flex flex-wrap gap-2">
												{bankItem.images.map((img) => (
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
		</>	);
}