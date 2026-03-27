import { Plus, Trash2, GripVertical } from "lucide-react";
import { useState } from "react";

export default function ThreadBuilder({ content, onUpdate, charLimit = 280 }) {
	const [dragging, setDragging] = useState(null);

	const addTweet = () => {
		onUpdate([
			...content,
			{ id: `content-${Date.now()}`, text: "", media_ids: [], sequence: content.length + 1 },
		]);
	};

	const updateTweet = (index, updates) => {
		const next = [...content];
		next[index] = { ...next[index], ...updates };
		onUpdate(next);
	};

	const removeTweet = (index) => {
		const next = content.filter((_, i) => i !== index);
		next.forEach((t, i) => { t.sequence = i + 1; });
		onUpdate(next);
	};

	const handleDragStart = (e, index) => {
		setDragging(index);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDrop = (e, targetIndex) => {
		e.preventDefault();
		if (dragging === null) return;
		const next = [...content];
		const [item] = next.splice(dragging, 1);
		next.splice(targetIndex, 0, item);
		next.forEach((t, i) => { t.sequence = i + 1; });
		onUpdate(next);
		setDragging(null);
	};

	return (
		<div className="space-y-0">
			{content.map((tweet, index) => (
				<div key={tweet.id} className="flex gap-3">
					{/* Left connector column */}
					<div className="flex flex-col items-center w-7 shrink-0 pt-3">
						<div className="w-7 h-7 rounded-full bg-[#252525] flex items-center justify-center text-[10px] text-zinc-400 font-medium shrink-0">
							{index === 0 ? "you" : index + 1}
						</div>
						{index < content.length - 1 && (
							<div className="w-px flex-1 bg-[#2a2a2a] my-1" />
						)}
					</div>

					{/* Card */}
					<div
						draggable
						onDragStart={(e) => handleDragStart(e, index)}
						onDragOver={handleDragOver}
						onDrop={(e) => handleDrop(e, index)}
						className={`group flex-1 mb-3 rounded-xl border transition-colors focus-within:border-zinc-600 ${
							dragging === index
								? "border-sky-500/30 bg-sky-500/5 opacity-70"
								: "border-[#252525] bg-[#1c1c1c]"
						}`}
					>
						<div className="flex items-start gap-2 px-3 pt-3 pb-1">
							{/* Drag handle — hover-only */}
							<div className="opacity-0 group-hover:opacity-100 transition-opacity pt-0.5 cursor-grab active:cursor-grabbing">
								<GripVertical size={14} className="text-zinc-600" />
							</div>

							<textarea
								value={tweet.text}
								onChange={(e) => updateTweet(index, { text: e.target.value })}
								placeholder={index === 0 ? "What's happening?" : "Continue the thread…"}
								rows={3}
								maxLength={charLimit}
								className="flex-1 bg-transparent resize-none text-sm text-zinc-200 placeholder-zinc-600 outline-none"
							/>

							{/* Delete — hover-only */}
							{content.length > 1 && (
								<button
									type="button"
									onClick={() => removeTweet(index)}
									className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
								>
									<Trash2 size={13} />
								</button>
							)}
						</div>

						<div className="px-3 pb-2 flex justify-end">
							<span className={`text-[10px] ${tweet.text.length > charLimit * 0.96 ? "text-yellow-500" : "text-zinc-600"}`}>
								{tweet.text.length} / {charLimit}
							</span>
						</div>
					</div>
				</div>
			))}

			{/* Add to thread */}
			<div className="flex gap-3">
				<div className="w-7 shrink-0 flex justify-center pt-2">
					<div className="w-7 h-7 rounded-full border border-dashed border-zinc-700 flex items-center justify-center">
						<Plus size={12} className="text-zinc-600" />
					</div>
				</div>
				<button
					type="button"
					onClick={addTweet}
					className="flex-1 text-left text-sm text-zinc-600 hover:text-zinc-400 py-2 transition-colors"
				>
					+ Add to thread
				</button>
			</div>
		</div>
	);
}

