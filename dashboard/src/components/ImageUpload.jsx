import { useState, useRef } from "react";
import { Upload, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { api } from "../api.js";

export default function ImageUpload({ postId, onUploaded, compact = false }) {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState(null);
	const [dragActive, setDragActive] = useState(false);
	const fileInputRef = useRef(null);

	const handleFiles = async (files) => {
		if (!files || files.length === 0) return;

		setUploading(true);
		setError(null);

		try {
			const result = await api.uploadPostImages(postId, Array.from(files));

			if (result.success) {
				if (onUploaded) {
					onUploaded(result.images);
				}
			} else {
				setError(result.error || "Failed to upload images");
			}

			if (result.errors && result.errors.length > 0) {
				setError(
					result.errors.join("; ") || "Some images failed to upload"
				);
			}
		} catch (err) {
			setError(err.message || "Upload failed");
		} finally {
			setUploading(false);
		}
	};

	const handleDrag = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(e.type === "dragenter" || e.type === "dragover");
	};

	const handleDrop = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);
		handleFiles(e.dataTransfer.files);
	};

	// Compact mode: just a small inline button that triggers the hidden file input
	if (compact) {
		return (
			<div className="inline-flex flex-col gap-2">
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept="image/*"
					onChange={(e) => handleFiles(e.target.files)}
					className="hidden"
				/>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					disabled={uploading}
					className="btn-ghost border border-[#252525] text-sm h-8 px-3 flex items-center gap-1.5"
				>
					{uploading
						? <Loader size={13} className="animate-spin" />
						: <Upload size={13} className="text-sky-500" />}
					{uploading ? "Uploading…" : "Add images"}
				</button>
				{error && <p className="text-xs text-red-400">{error}</p>}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<label className="block text-sm font-medium text-zinc-300">
				Upload Images
			</label>

			{/* Drag drop area */}
			<div
				onDragEnter={handleDrag}
				onDragLeave={handleDrag}
				onDragOver={handleDrag}
				onDrop={handleDrop}
				className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors card ${
					dragActive
						? "border-sky-500/50 bg-sky-500/5"
						: "border-[#2a2a2a] hover:border-zinc-600"
				}`}
			>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept="image/*"
					onChange={(e) => handleFiles(e.target.files)}
					className="hidden"
				/>

				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					disabled={uploading}
					className="flex flex-col items-center gap-3"
				>
					<Upload
						size={32}
						className={`${uploading ? "text-zinc-600" : "text-sky-500"}`}
					/>
					<div>
						<p className="font-medium text-zinc-100">
							{uploading ? "Uploading..." : "Click to upload or drag and drop"}
						</p>
						<p className="text-sm text-zinc-500">
							PNG, JPEG, GIF, WebP (max 10MB)
						</p>
					</div>
					{uploading && (
						<Loader size={20} className="animate-spin text-sky-500 mt-2" />
					)}
				</button>
			</div>

			{/* Error message */}
			{error && (
				<div className="flex gap-2 p-3 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">
					<AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
					<p>{error}</p>
				</div>
			)}
		</div>
	);
}
