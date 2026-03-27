import { Plus, Trash2, GripVertical } from "lucide-react";
import { useState } from "react";

export default function ThreadBuilder({ content, onUpdate, charLimit = Infinity }) {
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
			{content.map((tweet, index) => {
			const hasLimit = charLimit !== Infinity;
			const over = hasLimit && tweet.text.length > charLimit;
			const warn = hasLimit && !over && tweet.text.length > charLimit * 0.85;
				return (
					<div key={tweet.id} className="flex gap-3">
						{/* Thread connector column */}
						<div className="flex flex-col items-center w-7 shrink-0 pt-3">
							<div
								className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 font-mono"
								style={{
									background: index === 0 ? "var(--accent-dim2)" : "var(--bg-4)",
									color:      index === 0 ? "var(--accent)" : "var(--text-3)",
									border:     `1px solid ${index === 0 ? "rgba(168,230,61,0.3)" : "var(--border-2)"}`,
								}}
							>
								{index + 1}
							</div>
							{index < content.length - 1 && (
								<div className="w-px flex-1 my-1" style={{ background: "var(--border-2)" }} />
							)}
						</div>

						{/* Card */}
						<div
							draggable
							onDragStart={(e) => handleDragStart(e, index)}
							onDragOver={handleDragOver}
							onDrop={(e) => handleDrop(e, index)}
							className="group flex-1 mb-3 rounded-xl transition-all"
							style={{
								background: dragging === index ? "rgba(168,230,61,0.04)" : "var(--bg-2)",
								border:     `1px solid ${dragging === index ? "rgba(168,230,61,0.2)" : "var(--border)"}`,
								opacity:    dragging === index ? 0.6 : 1,
							}}
						>
							<div className="flex items-start gap-2 px-3 pt-3 pb-1">
								{/* Drag handle */}
								<div
									className="opacity-0 group-hover:opacity-100 transition-opacity pt-0.5 cursor-grab active:cursor-grabbing"
									style={{ color: "var(--text-3)" }}
								>
									<GripVertical size={13} />
								</div>

								<textarea
									value={tweet.text}
									onChange={(e) => updateTweet(index, { text: e.target.value })}
									placeholder={index === 0 ? "What's happening?" : "Continue the thread…"}
									rows={3}
									className="flex-1 bg-transparent resize-none text-sm outline-none font-mono leading-relaxed"
									style={{
										color: "var(--text)",
										caretColor: "var(--accent)",
									}}
								/>

								{/* Delete */}
								{content.length > 1 && (
									<button
										type="button"
										onClick={() => removeTweet(index)}
										className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
										style={{ color: "var(--text-3)" }}
										onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-dim)"; }}
										onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
									>
										<Trash2 size={12} />
									</button>
								)}
							</div>

							<div className="px-3 pb-2 flex justify-end">
						<span
								className="text-[10px] font-mono"
								style={{ color: over ? "var(--red)" : warn ? "var(--amber)" : "var(--text-3)" }}
							>
								{charLimit === Infinity
									? tweet.text.length
									: `${tweet.text.length} / ${charLimit.toLocaleString()}`}
							</span>
							</div>
						</div>
					</div>
				);
			})}

			{/* Add to thread */}
			<div className="flex gap-3">
				<div className="w-7 shrink-0 flex justify-center pt-2">
					<div
						className="w-7 h-7 rounded-full flex items-center justify-center"
						style={{
							border: "1px dashed var(--border-2)",
							color: "var(--text-3)",
						}}
					>
						<Plus size={11} />
					</div>
				</div>
				<button
					type="button"
					onClick={addTweet}
					className="flex-1 text-left text-sm py-2 transition-colors"
					style={{ color: "var(--text-3)" }}
					onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
					onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}
				>
					+ Add to thread
				</button>
			</div>
		</div>
	);
}
