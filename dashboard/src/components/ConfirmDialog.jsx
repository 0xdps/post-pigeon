export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText = "Delete", cancelText = "Cancel", isDangerous = true }) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-sm p-6 shadow-xl">
				<h2 className="text-lg font-semibold text-zinc-100 mb-2">{title}</h2>
				<p className="text-sm text-zinc-400 mb-6">{message}</p>

				<div className="flex gap-3 justify-end">
					<button
						onClick={onCancel}
						className="px-4 py-2 rounded-lg text-sm font-medium transition-colors
                   bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-200"
					>
						{cancelText}
					</button>
					<button
						onClick={onConfirm}
						className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
							isDangerous
								? "bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
								: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
						}`}
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
}
