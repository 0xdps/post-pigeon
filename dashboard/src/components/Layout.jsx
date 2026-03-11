import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LayoutDashboard, Clock, Settings, LogOut, FileText, Layers3, Plus } from "lucide-react";
import { api, initializeFileAccess } from "../api.js";

const NAV = [
	{ to: "/",          icon: LayoutDashboard, label: "Overview",   end: true, section: "main"    },
	{ to: "/posts",     icon: FileText,        label: "Library",              section: "publish"  },
	{ to: "/queue",     icon: Clock,           label: "Queue",                section: "publish"  },
	{ to: "/platforms", icon: Layers3,         label: "Platforms",            section: "manage"   },
	{ to: "/settings",  icon: Settings,        label: "Settings",             section: "manage"   },
];

const SECTION_LABELS = {
	main:    null,
	publish: "Publish",
	manage:  "Manage",
};

export default function Layout() {
	const navigate = useNavigate();

	// Initialize file manager with session token on mount
	useEffect(() => {
		initializeFileAccess().then((success) => {
			if (success) {
				console.log('[Layout] File access initialized with header-based auth');
			} else {
				console.log('[Layout] Using proxy-based file access');
			}
		});
	}, []);

	const handleLogout = async () => {
		await api.logout();
		navigate("/login");
	};

	return (
		<div className="flex h-screen overflow-hidden bg-[#161616]">
			{/* Sidebar */}
			<aside className="w-56 flex-shrink-0 flex flex-col bg-[#111111] border-r border-[#1e1e1e]">
				{/* Logo */}
				<div className="h-14 flex items-center gap-2.5 px-5 border-b border-[#1e1e1e]">
					<img src="/logo-32.png" alt="PostPigeon" className="w-7 h-7 object-contain" />
					<span className="font-semibold text-sm tracking-tight">PostPigeon</span>
				</div>

				{/* Compose */}
				<div className="px-2 py-2 border-b border-[#1e1e1e]">
					<Link
						to="/posts/new"
						className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded-lg text-sm font-medium bg-amber-400 text-black hover:bg-amber-300 transition-colors"
					>
						<Plus size={14} /> Compose
					</Link>
				</div>

				{/* Nav */}
				<nav className="flex-1 p-2 overflow-y-auto">
					{Object.keys(SECTION_LABELS).map((section) => {
						const entries = NAV.filter((n) => n.section === section);
						if (!entries.length) return null;
						return (
							<div key={section} className="mb-3">
							{SECTION_LABELS[section] && (
								<p className="px-3 py-1 text-[11px] uppercase tracking-wider text-zinc-700 font-medium">
									{SECTION_LABELS[section]}
								</p>
							)}
								<div className="space-y-0.5">
									{entries.map(({ to, icon: Icon, label, end }) => (
										<NavLink
											key={to}
											to={to}
											end={end}
											className={({ isActive }) =>
											`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
												isActive
													? "bg-amber-400/10 text-amber-300"
													: "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
											}`
										}
									>
										<Icon size={14} className="shrink-0" />
											{label}
										</NavLink>
									))}
								</div>
							</div>
						);
					})}
				</nav>

				{/* Logout */}
				<div className="p-2 border-t border-[#1e1e1e]">
					<button
						onClick={handleLogout}
						className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm
                       text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
					>
						<LogOut size={15} />
						Logout
					</button>
				</div>
			</aside>

			{/* Main */}
			<main className="flex-1 overflow-y-auto">
				<Outlet />
			</main>
		</div>
	);
}
