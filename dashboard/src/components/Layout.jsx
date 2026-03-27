import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LayoutDashboard, BookOpen, Activity, Radio, Settings, LogOut, PenLine, BookMarked } from "lucide-react";
import { api, initializeFileAccess } from "../api.js";

const NAV = [
	{ to: "/",          icon: LayoutDashboard, label: "Overview",  end: true },
	{ to: "/library",   icon: BookOpen,        label: "Posts"               },
	{ to: "/activity",  icon: Activity,        label: "Activity"            },
	{ to: "/channels",  icon: Radio,           label: "Platforms"           },
	{ to: "/settings",  icon: Settings,        label: "Settings"            },
];

export default function Layout() {
	const navigate = useNavigate();

	useEffect(() => {
		initializeFileAccess().catch(() => {});
	}, []);

	const handleLogout = async () => {
		await api.logout();
		navigate("/login");
	};

	return (
		<div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
			{/* ── Sidebar ── */}
			<aside
				className="w-52 flex-shrink-0 flex flex-col"
				style={{ background: "var(--bg-2)", borderRight: "1px solid var(--border)" }}
			>
				{/* Brand */}
				<div
					className="h-14 flex items-center gap-2.5 px-4 flex-shrink-0"
					style={{ borderBottom: "1px solid var(--border)" }}
				>
					<img src="/logo-32.png" alt="PostPigeon" className="w-6 h-6 object-contain" />
					<span className="font-bold text-sm tracking-tight" style={{ color: "var(--text)" }}>
						Post<span style={{ color: "var(--accent)" }}>Pigeon</span>
					</span>
				</div>

				{/* Compose — primary CTA */}
				<div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
					<Link
						to="/compose"
						className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
						style={{ background: "var(--accent)", color: "#080808" }}
						onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-2)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
					>
						<PenLine size={14} />
						Write a post
					</Link>
				</div>

				{/* Nav */}
				<nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
					{NAV.map(({ to, icon: Icon, label, end }) => (
						<NavLink
							key={to}
							to={to}
							end={end}
							className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
						>
							<Icon size={14} className="shrink-0" />
							{label}
						</NavLink>
					))}
				</nav>

			{/* Setup Guide + Logout */}
			<div className="p-2 space-y-0.5" style={{ borderTop: "1px solid var(--border)" }}>
				<NavLink
					to="/guide"
					className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
				>
					<BookMarked size={14} className="shrink-0" />
					Setup Guide
				</NavLink>
				<button onClick={handleLogout} className="nav-link w-full text-left">
					<LogOut size={14} />
					Logout
				</button>
			</div>
			</aside>

			{/* ── Content ── */}
			<main className="flex-1 overflow-y-auto">
				<Outlet />
			</main>
		</div>
	);
}
