"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "../lib/client.js";

const LINKS = [
	{ href: "/overview", label: "Overview" },
	{ href: "/posts", label: "Posts" },
	{ href: "/activity", label: "Timeline" },
	{ href: "/platforms", label: "Platforms" },
	{ href: "/settings", label: "Settings" },
	{ href: "/guide", label: "Setup" },
];

export default function Shell({ children }) {
	const pathname = usePathname();
	return (
		<div className="shell">
			<aside className="nav">
				<Link href="/posts" className="brand">
					<img src="/logo-transparent.png" alt="" />
					<div>
						<strong>PostPigeon</strong>
						<span>for X</span>
					</div>
				</Link>
				<nav>
					<Link href="/compose" className="btn btn-sky" style={{ textAlign: "center" }}>Write a post</Link>
					{LINKS.map((link) => (
						<Link key={link.href} href={link.href} className="item" data-active={pathname.startsWith(link.href)}>
							{link.label}
						</Link>
					))}
				</nav>
				<button
					type="button"
					className="btn-ghost"
					onClick={async () => {
						await api.logout();
						window.location.href = "/login";
					}}
				>
					Log out
				</button>
			</aside>
			<div className="main">{children}</div>
		</div>
	);
}
