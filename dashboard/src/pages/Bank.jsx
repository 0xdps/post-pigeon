import { useState, useEffect } from "react";
import { Plus, Image, ChevronDown, ChevronUp, Check, Clock, Zap, CheckCircle, XCircle } from "lucide-react";
import { api } from "../api.js";
import { SecureImage } from "../components/SecureImage.jsx";
import { DateTimePicker } from "../components/DateTimePicker.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";

export default function Bank() {
	const [items, setItems] = useState([]);
	const [queued, setQueued] = useState(new Set());
	const [scheduledItems, setScheduledItems] = useState(new Set());
	const [postedItems, setPostedItems] = useState(new Set());
	const [loading, setLoading] = useState(true);
	const [expanded, setExpanded] = useState(null);
	const [adding, setAdding] = useState(null);
	const [added, setAdded] = useState(new Set());
	const [scheduling, setScheduling] = useState(null);
	const [scheduled, setScheduled] = useState(new Set());
	const [search, setSearch] = useState("");
	const [settings, setSettings] = useState(null);
	const [postsToday, setPostsToday] = useState(0);
	const [posting, setPosting] = useState(null);
	const [postResult, setPostResult] = useState({}); // { [itemId]: { ok, tweetId, error } }
	const [confirmPost, setConfirmPost] = useState(null); // item id pending confirm
	const [expandedTexts, setExpandedTexts] = useState({}); // { [itemId]: string }

	useEffect(() => {
		Promise.all([api.getBank(), api.getQueue(), api.getScheduled(), api.getPosted(), api.getSettings(), api.getState()]).then(async ([bankRes, queue, scheduledList, posted, settingsData, stateData]) => {
			const bank = bankRes?.success ? bankRes.items : [];
			setItems(bank || []);
			setQueued(new Set((queue || []).map((q) => String(q.local_id))));
			setScheduledItems(new Set((scheduledList || []).map((s) => String(s.local_id))));
			setPostedItems(new Set((posted || []).map((p) => String(p.localId))));
			setSettings(settingsData || {});
			setPostsToday(stateData?.posts_today ?? 0);
			setLoading(false);
		});
	}, []);

	const loadTextForItem = async (item) => {
		if (!item?.text_file_id) return;
		if (expandedTexts[item.id] !== undefined) return;
		const text = await api.getFileText(item.text_file_id);
		setExpandedTexts((prev) => ({ ...prev, [item.id]: text ?? "" }));
	};

	const handleAddToQueue = async (e, item) => {
		e.stopPropagation();
		setAdding(item.id);
		await api.addToQueue(item.id);
		setAdded((prev) => new Set(prev).add(item.id));
		setQueued((prev) => new Set(prev).add(String(item.id)));
		setAdding(null);
		setTimeout(
			() =>
				setAdded((prev) => {
					const n = new Set(prev);
					n.delete(item.id);
					return n;
				}),
			3000
		);
	};

	const handlePostNow = (item) => {
		const limit = settings?.daily_limit ?? 10;
		if (postsToday >= limit) {
			if (!settings?.manual_limit_override) {
				setPostResult((prev) => ({ ...prev, [item.id]: { limitBlocked: true } }));
				return;
			}
			setConfirmPost(item);
			return;
		}
		doPostNow(item, false);
	};

	const doPostNow = async (item, force) => {
		setPosting(item.id);
		setPostResult((prev) => ({ ...prev, [item.id]: null }));
		const r = await api.postItem(item.id, force);
		if (r?.tweetId) {
			setPostResult((prev) => ({ ...prev, [item.id]: { ok: true, tweetId: r.tweetId } }));
			setPostedItems((prev) => new Set(prev).add(String(item.id)));
			setQueued((prev) => { const n = new Set(prev); n.delete(String(item.id)); return n; });
			setScheduledItems((prev) => { const n = new Set(prev); n.delete(String(item.id)); return n; });
			setPostsToday((p) => p + 1);
		} else {
			setPostResult((prev) => ({ ...prev, [item.id]: { error: r?.error || r?.reason || "Failed" } }));
		}
		setPosting(null);
	};

	const handleSchedule = async (scheduledAt) => {
		try {
			await api.createScheduled(scheduling, scheduledAt);
			setScheduledItems((prev) => new Set(prev).add(String(scheduling)));
			setScheduled((prev) => new Set(prev).add(scheduling));
			setScheduling(null);
			setTimeout(
				() =>
					setScheduled((prev) => {
						const n = new Set(prev);
						n.delete(scheduling);
						return n;
					}),
				3000
			);
		} catch (err) {
			alert("Failed to schedule: " + err.message);
		}
	};

	const filtered = search
		? items.filter(
				(i) => String(i.id).includes(search) || (i.title || "").toLowerCase().includes(search.toLowerCase())
			)
		: items;

	if (loading) return <div className="p-8 text-zinc-600 text-sm">Loading…</div>;

	return (
		<>
			<ConfirmDialog
				isOpen={!!confirmPost}
				title="Daily limit reached"
				message={`You've posted ${postsToday}/${settings?.daily_limit ?? 10} times today. Post item ${confirmPost?.id} anyway?`}
				confirmText="Post anyway"
				onConfirm={() => { const item = confirmPost; setConfirmPost(null); doPostNow(item, true); }}
				onCancel={() => setConfirmPost(null)}
			/>
			<div className="p-8 max-w-4xl">
			<div className="mb-6">
				<h1 className="text-xl font-semibold">Content Bank</h1>
				<p className="text-zinc-500 text-sm mt-0.5">{items.length} items · updates via git push</p>
			</div>

			<input
				type="text"
				placeholder="Search by ID or content…"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				className="input-field mb-6 w-full"		/>

		<div className="space-y-1.5">
			{filtered.map((item) => {
				const isExpanded = expanded === item.id;
				const isAdded = added.has(item.id);
				const isQueued = queued.has(String(item.id));
				const isPosted = postedItems.has(String(item.id));
				return (
					<div
						key={item.id}
						className={`card rounded-xl overflow-hidden transition-colors ${
							isQueued ? "border-sky-500/30" : "hover:border-zinc-700"
						}`}
					>
						<div
							className="flex items-center gap-4 px-4 py-3 cursor-pointer"
							onClick={() => {
								if (isExpanded) {
									setExpanded(null);
									return;
								}
								setExpanded(item.id);
								void loadTextForItem(item);
							}}
						>
							<span className={`font-mono text-sm w-16 flex-shrink-0 ${isPosted ? "text-emerald-400" : "text-sky-500"}`}>{item.id}</span>

								<p className="flex-1 text-sm text-zinc-400 truncate leading-relaxed">
							{item.title}
						</p>

						{item.images?.length > 0 && (
							<span className="flex items-center gap-1 text-xs text-zinc-700 flex-shrink-0">
								<Image size={11} />
								{item.images.length}
							</span>
						)}

						<button
							onClick={(e) => handleAddToQueue(e, item)}
							disabled={adding === item.id || isQueued || isPosted}
							className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ml-2 ${
								isAdded || isQueued
									? "bg-emerald-500/10 text-emerald-400 cursor-default"
									: isPosted
									? "bg-zinc-800 text-zinc-600 cursor-default opacity-40"
									: "bg-zinc-800 text-zinc-400 hover:bg-sky-500/10 hover:text-sky-500"
							}`}
						>
							{isAdded || isQueued ? <Check size={11} /> : <Plus size={11} />}
							{isAdded || isQueued ? "Queued" : "Queue"}
						</button>

						<button
							onClick={(e) => {
								e.stopPropagation();
								setScheduling(item.id);
							}}
							disabled={scheduledItems.has(String(item.id)) || scheduled.has(item.id) || isPosted}
							className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
								scheduledItems.has(String(item.id)) || scheduled.has(item.id)
									? "bg-blue-500/10 text-blue-400 cursor-default"
									: isPosted
									? "bg-zinc-800 text-zinc-600 cursor-default opacity-40"
									: "bg-zinc-800 text-zinc-400 hover:bg-blue-400/10 hover:text-blue-400"
							}`}
						>
							<Clock size={11} />
							{scheduledItems.has(String(item.id)) || scheduled.has(item.id) ? "Scheduled" : "Schedule"}
						</button>

						<span className="text-zinc-700 flex-shrink-0">
							{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
						</span>
					</div>

				{isExpanded && (
					<div className="px-4 pb-4 pt-1 border-t border-[#1a1a1a]">
						{expandedTexts[item.id] === undefined ? (
							<p className="text-xs text-zinc-600">Loading…</p>
						) : (
							<p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono">
								{expandedTexts[item.id]}
							</p>
						)}
						{item.images?.length > 0 && (
							<div className="mt-3 flex flex-wrap gap-2">
								{item.images.map((img) => (
									<SecureImage
										key={img.id}
										fileId={img.file_id}
										alt={img.filename}
										className="w-32 h-32 object-cover rounded-lg border border-zinc-800"
									/>
								))}
							</div>
						)}
						<div className="mt-4 flex items-center gap-3">
							<button
								onClick={() => handlePostNow(item)}
								disabled={posting === item.id || isPosted}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
									isPosted
										? "bg-emerald-500/10 text-emerald-400 cursor-default"
										: "bg-sky-500/10 text-sky-500 hover:bg-sky-500/20"
								}`}
							>
								{isPosted ? <CheckCircle size={11} /> : <Zap size={11} />}
								{isPosted ? "Posted" : posting === item.id ? "Posting…" : "Post Now"}
							</button>
							{postResult[item.id]?.ok && (
								<span className="flex items-center gap-1 text-xs text-emerald-400">
									<CheckCircle size={11} /> Posted!
								</span>
							)}
							{postResult[item.id]?.error && (
								<span className="flex items-center gap-1 text-xs text-red-400">
									<XCircle size={11} /> {postResult[item.id].error}
								</span>
							)}
							{postResult[item.id]?.limitBlocked && (
								<span className="text-xs text-sky-500">
									Daily limit reached. Enable override in Settings.
								</span>
							)}
						</div>
					</div>
				)}
				</div>
			);
		})}
		</div>
	</div>

	{scheduling && (
		<DateTimePicker
			onSelect={handleSchedule}
			onClose={() => setScheduling(null)}
		/>
	)}
	</>
	);
}
