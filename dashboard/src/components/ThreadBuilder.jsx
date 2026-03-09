import { Plus, Trash2, GripVertical } from "lucide-react";
import { useState } from "react";

export default function ThreadBuilder({ content, onUpdate }) {
	const [dragging, setDragging] = useState(null);

	const addTweet = () => {
		const newContent = [...content];
		newContent.push({
			id: `content-${Date.now()}`,
			text: "",
			media_ids: [],
			sequence: content.length + 1,
		});
		onUpdate(newContent);
	};

	const updateTweet = (index, updates) => {
		const newContent = [...content];
		newContent[index] = { ...newContent[index], ...updates };
		onUpdate(newContent);
	};

	const removeTweet = (index) => {
		const newContent = content.filter((_, i) => i !== index);
		// Update sequences
		newContent.forEach((tweet, i) => {
			tweet.sequence = i + 1;
		});
		onUpdate(newContent);
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

		const newContent = [...content];
		const draggedItem = newContent[dragging];
		newContent.splice(dragging, 1);
		newContent.splice(targetIndex, 0, draggedItem);
		
		// Update sequences
		newContent.forEach((tweet, i) => {
			tweet.sequence = i + 1;
		});
		
		onUpdate(newContent);
		setDragging(null);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm font-medium text-zinc-300">
					Thread Tweets ({content.length})
				</p>
				<button
					type="button"
					onClick={addTweet}
					className="btn-primary h-8 px-3"
				>
					<Plus size={14} />
					Add Tweet
				</button>
			</div>

			<div className="space-y-3 max-h-[600px] overflow-y-auto">
				{content.map((tweet, index) => (
					<div
						key={tweet.id}
						draggable
						onDragStart={(e) => handleDragStart(e, index)}
						onDragOver={handleDragOver}
						onDrop={(e) => handleDrop(e, index)}
						className={`p-4 rounded-lg transition-colors card ${
							dragging === index
								? "bg-amber-400/10 border-amber-400/30 opacity-70"
								: "hover:border-zinc-700"
						}`}
					>
						<div className="flex gap-3">
							{/* Drag handle */}
							<div className="flex items-start pt-2">
								<GripVertical size={16} className="text-zinc-500 cursor-grab active:cursor-grabbing" />
							</div>

							<div className="flex-1 space-y-2">
								{/* Tweet number */}
								<div className="flex items-center gap-2">
									<span className="inline-flex items-center justify-center w-6 h-6 bg-[#252525] rounded-full text-xs font-medium text-zinc-200">
										{index + 1}
									</span>
									<span className="text-xs text-zinc-500">
										Tweet {index + 1} of {content.length}
									</span>
								</div>

								{/* Text input */}
								<textarea
									value={tweet.text}
									onChange={(e) => updateTweet(index, { text: e.target.value })}
									placeholder={`Write tweet ${index + 1}...`}
									rows={4}
									maxLength={280}
									className="input-field font-mono text-sm"
								/>

								{/* Character count */}
								<div className="flex items-center justify-between text-xs">
									<span className={tweet.text.length > 270 ? "text-yellow-500" : "text-zinc-500"}>
										{tweet.text.length} / 280
									</span>
									{tweet.media_ids && tweet.media_ids.length > 0 && (
										<span className="text-zinc-500">
											{tweet.media_ids.length} image(s)
										</span>
									)}
								</div>
							</div>

							{/* Delete button */}
							<button
								type="button"
								onClick={() => removeTweet(index)}
								className="p-2 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
								title="Delete this tweet"
							>
								<Trash2 size={16} />
							</button>
						</div>
					</div>
				))}
			</div>

			<div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-300 text-sm">
				Tip: Drag tweets to reorder the thread posting sequence.
			</div>
		</div>
	);
}
