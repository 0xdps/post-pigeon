import { Plus, X } from "lucide-react";

export default function ThreadBuilder({ content, onUpdate, charLimit = Infinity, disabled = false }) {
	const addTweet = () => {
		onUpdate([
			...content,
			{ id: `content-${Date.now()}`, text: "", media_ids: [], sequence: content.length + 1 },
		]);
	};

	const updateTweet = (index, text) => {
		const next = [...content];
		next[index] = { ...next[index], text };
		onUpdate(next);
	};

	const removeTweet = (index) => {
		const next = content.filter((_, i) => i !== index);
		next.forEach((t, i) => { t.sequence = i + 1; });
		onUpdate(next);
	};

	const hasLimit = charLimit !== Infinity;

	return (
		<div className="space-y-0">
			{content.map((tweet, index) => {
				const len  = tweet.text.length;
				const over = hasLimit && len > charLimit;
				const warn = hasLimit && !over && len > charLimit * 0.85;

				return (
					<div key={tweet.id} className="flex gap-3">
						{/* Thread connector */}
						<div className="flex flex-col items-center w-5 shrink-0 pt-4">
							<span
								className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold font-mono shrink-0"
								style={{
									background: index === 0 ? "var(--accent-dim2)" : "var(--bg-4)",
									color:      index === 0 ? "var(--accent)" : "var(--text-3)",
									border:     `1px solid ${index === 0 ? "var(--accent-dim2)" : "var(--border-2)"}`,
								}}
							>
								{index + 1}
							</span>
							{index < content.length - 1 && (
								<div className="w-px flex-1 my-1.5" style={{ background: "var(--border-2)" }} />
							)}
						</div>

						{/* Textarea — same style as standalone */}
						<div className="flex-1 mb-3 relative group">
							<textarea
								value={tweet.text}
								onChange={e => updateTweet(index, e.target.value)}
								placeholder={index === 0 ? "What do you want to say?" : "Continue the thread…"}
								disabled={disabled}
								rows={index === 0 ? 8 : 5}
								className="textarea-field"
								style={{ width: "100%", fontSize: "0.9375rem", lineHeight: "1.7" }}
							/>

							{/* Remove button (top-right, appears on hover) */}
							{content.length > 1 && !disabled && (
								<button
									type="button"
									onClick={() => removeTweet(index)}
									className="absolute top-2.5 right-2.5 w-5 h-5 rounded flex items-center justify-center
									           opacity-0 group-hover:opacity-100 transition-opacity"
									style={{ background: "var(--bg-4)", color: "var(--text-3)" }}
									onMouseEnter={e => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-dim)"; }}
									onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "var(--bg-4)"; }}
									title="Remove tweet"
								>
									<X size={10} />
								</button>
							)}

							{/* Char counter */}
							<div className="flex justify-end mt-1.5">
								<span
									className="text-[11px] font-mono"
									style={{ color: over ? "var(--red)" : warn ? "var(--amber)" : "var(--text-3)" }}
								>
									{hasLimit ? `${len} / ${charLimit.toLocaleString()}` : len}
								</span>
							</div>
						</div>
					</div>
				);
			})}

			{/* Add tweet */}
			{!disabled && (
				<div className="flex gap-3 items-center">
					<div className="w-5 shrink-0 flex justify-center">
						<div
							className="w-5 h-5 rounded-full flex items-center justify-center"
							style={{ border: "1px dashed var(--border-2)", color: "var(--text-3)" }}
						>
							<Plus size={9} />
						</div>
					</div>
					<button
						type="button"
						onClick={addTweet}
						className="text-xs py-1 transition-colors"
						style={{ color: "var(--text-3)" }}
						onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
						onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; }}
					>
						+ Add tweet to thread
					</button>
				</div>
			)}
		</div>
	);
}
