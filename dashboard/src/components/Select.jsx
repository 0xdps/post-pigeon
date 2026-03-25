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

	// Normalise options to { value, label }
	const items = options.map((o) => Array.isArray(o) ? { value: o[0], label: o[1] } : o);
	const selected = items.find((o) => o.value === value);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		const handler = (e) => {
			if (ref.current && !ref.current.contains(e.target)) setOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	// Close on Escape
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
				className={`
					w-full flex items-center justify-between gap-3 px-3 py-2
					bg-[#1d1d1d] border rounded-lg text-sm text-left
					transition-all duration-150 cursor-pointer
					${open
						? "border-sky-500/40 ring-1 ring-sky-500/20 text-zinc-100"
						: "border-[#2e2e2e] text-zinc-300 hover:border-[#3a3a3a]"
					}
				`}
			>
				<span className="truncate">{selected?.label ?? placeholder}</span>
				<ChevronDown
					size={14}
					className={`shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{/* Dropdown panel */}
			{open && (
				<div className="
					absolute z-50 mt-1.5 w-full min-w-[200px]
					bg-[#1e1e1e] border border-[#282828] rounded-xl
					shadow-2xl shadow-black/60
					py-1 overflow-y-auto max-h-64
					dropdown-enter
				">
					{items.map((item) => {
						const isSelected = item.value === value;
						return (
							<button
								key={item.value}
								type="button"
								onClick={() => { onChange(item.value); setOpen(false); }}
								className={`
									w-full flex items-center justify-between gap-2
									px-3 py-2 text-sm text-left transition-colors
									${isSelected
										? "text-sky-400 bg-sky-500/8"
										: "text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-100"
									}
								`}
							>
								<span className="truncate">{item.label}</span>
								{isSelected && <Check size={13} className="shrink-0 text-sky-500" />}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
