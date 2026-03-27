import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Custom styled dropdown.
 * Props:
 *   value      – current selected value
 *   onChange   – called with the new value string
 *   options    – array of [value, label] pairs  OR  array of { value, label } objects
 *   placeholder – shown when nothing is selected
 *   className  – extra class on the trigger button
 */
export default function Select({ value, onChange, options = [], placeholder = "Select…", className = "" }) {
	const [open, setOpen] = useState(false);
	const ref = useRef(null);

	const items    = options.map((o) => Array.isArray(o) ? { value: o[0], label: o[1] } : o);
	const selected = items.find((o) => o.value === value);

	useEffect(() => {
		if (!open) return;
		const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const handler = (e) => { if (e.key === "Escape") setOpen(false); };
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [open]);

	return (
		<div ref={ref} className={`relative ${className}`}>
			{/* Trigger */}
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-left transition-all cursor-pointer"
				style={{
					background:  "var(--bg-3)",
					color:       "var(--text)",
					border:      `1px solid ${open ? "rgba(168,230,61,0.35)" : "var(--border-2)"}`,
					boxShadow:   open ? "0 0 0 3px rgba(168,230,61,0.06)" : "none",
				}}
			>
				<span className="truncate">{selected?.label ?? placeholder}</span>
				<ChevronDown
					size={13}
					style={{
						color: "var(--text-3)",
						transform: open ? "rotate(180deg)" : "none",
						transition: "transform 0.2s",
						flexShrink: 0,
					}}
				/>
			</button>

			{/* Dropdown */}
			{open && (
				<div
					className="absolute z-50 mt-1.5 w-full min-w-[200px] rounded-xl py-1 overflow-y-auto max-h-64 dropdown-enter"
					style={{
						background: "var(--bg-3)",
						border:     "1px solid var(--border-2)",
						boxShadow:  "0 16px 48px rgba(0,0,0,0.6)",
					}}
				>
					{items.map((item) => {
						const isSel = item.value === value;
						return (
							<button
								key={item.value}
								type="button"
								onClick={() => { onChange(item.value); setOpen(false); }}
								className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors"
								style={{
									color:      isSel ? "var(--accent)" : "var(--text-2)",
									background: isSel ? "var(--accent-dim)" : "transparent",
								}}
								onMouseEnter={(e) => { if (!isSel) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "var(--text)"; } }}
								onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; } }}
							>
								<span className="truncate">{item.label}</span>
								{isSel && <Check size={12} style={{ flexShrink: 0, color: "var(--accent)" }} />}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
