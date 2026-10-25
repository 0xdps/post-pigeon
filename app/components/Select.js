"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function Select({ value, onChange, options = [], placeholder = "Select", label }) {
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const root = useRef(null);
	const listId = useId();
	const items = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
	const selected = items.find((item) => item.value === value);

	useEffect(() => {
		if (!open) return undefined;
		function onPointer(event) {
			if (root.current && !root.current.contains(event.target)) setOpen(false);
		}
		function onKey(event) {
			if (event.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function choose(next) {
		onChange(next);
		setOpen(false);
	}

	function onTriggerKey(event) {
		if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			setOpen(true);
			setActive(Math.max(0, items.findIndex((item) => item.value === value)));
		}
	}

	function onListKey(event) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActive((index) => Math.min(items.length - 1, index + 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((index) => Math.max(0, index - 1));
		} else if (event.key === "Enter" && items[active]) {
			event.preventDefault();
			choose(items[active].value);
		}
	}

	return (
		<div className="select" ref={root} data-open={open}>
			<button
				type="button"
				className="select-trigger"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={listId}
				aria-label={label}
				onClick={() => setOpen((current) => !current)}
				onKeyDown={onTriggerKey}
			>
				<span>{selected?.label || placeholder}</span>
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path d="M4 6.2 8 10l4-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
				</svg>
			</button>
			{open ? (
				<ul id={listId} className="select-menu" role="listbox" tabIndex={-1} onKeyDown={onListKey}>
					{items.map((item, index) => (
						<li key={item.value} role="presentation">
							<button
								type="button"
								role="option"
								aria-selected={item.value === value}
								data-active={index === active}
								onMouseEnter={() => setActive(index)}
								onClick={() => choose(item.value)}
							>
								{item.label}
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
