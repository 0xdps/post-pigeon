import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Eye, EyeOff } from "lucide-react";
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
		<div className="min-h-screen flex items-center justify-center bg-[#090909] relative overflow-hidden">
			{/* Ambient glow */}
			<div
				className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px]
                      bg-amber-400/5 blur-[120px] rounded-full pointer-events-none"
			/>

			<div className="relative w-full max-w-sm mx-4">
				{/* Logo mark */}
				<div className="flex flex-col items-center mb-10">
					<div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-amber-400/20">
						<Zap size={22} className="text-black" />
					</div>
					<h1 className="text-lg font-semibold">PostHub</h1>
					<p className="text-zinc-500 text-sm mt-0.5">Admin Dashboard</p>
				</div>

				{/* Card */}
				<div className="card p-7">
					<h2 className="text-base font-semibold mb-1">Sign in</h2>
					<p className="text-zinc-500 text-sm mb-6">Enter your admin token to continue.</p>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
								Admin Token
							</label>
							<div className="relative">
								<input
									type={show ? "text" : "password"}
									value={token}
									onChange={(e) => setToken(e.target.value)}
									placeholder="••••••••••••••••"
									className="input-field pr-10 font-mono"
									autoFocus
									autoComplete="current-password"
								/>
								<button
									type="button"
									onClick={() => setShow((v) => !v)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
								>
									{show ? <EyeOff size={14} /> : <Eye size={14} />}
								</button>
							</div>
						</div>

						{error && <p className="text-xs text-red-400 flex items-center gap-1">{error}</p>}

						<button
							type="submit"
							disabled={loading || !token}
							className="btn-primary w-full justify-center py-2.5"
						>
							{loading ? "Signing in…" : "Sign In"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
