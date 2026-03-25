import { useMemo, useState } from "react";
import { Clock, ListOrdered, CheckCircle2 } from "lucide-react";
import Queue from "./Queue.jsx";
import { Scheduled } from "./Scheduled.jsx";
import Posted from "./Posted.jsx";

const TABS = [
	{ id: "queue", label: "Queue", icon: ListOrdered },
	{ id: "scheduled", label: "Scheduled", icon: Clock },
	{ id: "posted", label: "Posted", icon: CheckCircle2 },
];

export default function Activity() {
	const [tab, setTab] = useState("queue");

	const activeLabel = useMemo(() => TABS.find((t) => t.id === tab)?.label || "Queue", [tab]);

	return (
		<div className="min-h-full">
			<div className="px-8 pt-8">
				<div className="mb-6">
					<h1 className="text-xl font-semibold">Activity</h1>
					<p className="text-zinc-500 text-sm mt-0.5">Queue, scheduled, and posted history in one place.</p>
				</div>

				<div className="card rounded-xl p-2 flex items-center gap-1.5 max-w-md">
					{TABS.map(({ id, label, icon: Icon }) => (
						<button
							key={id}
							type="button"
							onClick={() => setTab(id)}
							className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
								tab === id
									? "bg-sky-500/10 text-sky-500"
									: "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
							}`}
						>
							<Icon size={14} />
							{label}
						</button>
					))}
				</div>

				<p className="text-xs text-zinc-600 mt-3">Showing: {activeLabel}</p>
			</div>

			<div>
				{tab === "queue" && <Queue />}
				{tab === "scheduled" && <Scheduled />}
				{tab === "posted" && <Posted />}
			</div>
		</div>
	);
}
