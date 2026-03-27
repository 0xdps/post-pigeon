import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { api } from "../api.js";

export default function Login() {
	const [token, setToken] = useState("");
	const [show, setShow] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		const result = await api.login(token);
		setLoading(false);
		if (result?.ok) {
			navigate("/");
		} else {
			setError(result?.error || "Invalid token");
		}
	};

	return (
		<div
			className="min-h-screen flex items-center justify-center relative overflow-hidden"
			style={{ background: "var(--bg)" }}
		>
			{/* Ambient accent glow */}
			<div
				className="absolute pointer-events-none"
				style={{
					top: "-10%",
					left: "50%",
					transform: "translateX(-50%)",
					width: 500,
					height: 300,
					background: "radial-gradient(ellipse, rgba(168,230,61,0.07) 0%, transparent 70%)",
				}}
			/>
			{/* Grid texture */}
			<div
				className="absolute inset-0 pointer-events-none opacity-[0.03]"
				style={{
					backgroundImage: "linear-gradient(var(--border-2) 1px, transparent 1px), linear-gradient(90deg, var(--border-2) 1px, transparent 1px)",
					backgroundSize: "40px 40px",
				}}
			/>

			<div className="relative w-full max-w-sm mx-6 animate-fade-up">
				{/* Logo */}
				<div className="mb-10 text-center">
					<div
						className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
						style={{ background: "var(--accent-dim2)", border: "1px solid rgba(168,230,61,0.2)" }}
					>
						<img src="/logo-32.png" alt="" className="w-7 h-7 object-contain" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
						Post<span style={{ color: "var(--accent)" }}>Pigeon</span>
					</h1>
					<p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
						Publishing control center
					</p>
				</div>

				{/* Card */}
				<div
					className="rounded-2xl p-6"
					style={{
						background: "var(--bg-2)",
						border: "1px solid var(--border-2)",
					}}
				>
					<p className="text-sm font-medium mb-5" style={{ color: "var(--text)" }}>
						Enter your admin token
					</p>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="relative">
							<input
								type={show ? "text" : "password"}
								value={token}
								onChange={(e) => setToken(e.target.value)}
								placeholder="admin-token-••••••••"
								className="input-field pr-10 font-mono"
								autoFocus
								autoComplete="current-password"
							/>
							<button
								type="button"
								onClick={() => setShow((v) => !v)}
								className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
								style={{ color: "var(--text-3)" }}
							>
								{show ? <EyeOff size={14} /> : <Eye size={14} />}
							</button>
						</div>

						{error && (
							<p className="text-xs flex items-center gap-1.5" style={{ color: "var(--red)" }}>
								<span className="w-1.5 h-1.5 rounded-full bg-current" />
								{error}
							</p>
						)}

						<button
							type="submit"
							disabled={loading || !token}
							className="btn-primary w-full justify-center py-2.5"
						>
							{loading ? "Authenticating…" : (
								<>Continue <ArrowRight size={14} /></>
							)}
						</button>
					</form>
				</div>

				<p className="text-center text-[11px] mt-6" style={{ color: "var(--text-3)" }}>
					PostPigeon Admin · Protected
				</p>
			</div>
		</div>
	);
}
