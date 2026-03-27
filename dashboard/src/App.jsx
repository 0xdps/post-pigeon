import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Compose from "./pages/Compose.jsx";
import Library from "./pages/Library.jsx";
import Activity from "./pages/Activity.jsx";
import Channels from "./pages/Channels.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/login" element={<Login />} />
				<Route path="/" element={<Layout />}>
					<Route index element={<Dashboard />} />
					<Route path="compose" element={<Compose />} />
					<Route path="compose/:id" element={<Compose />} />
					<Route path="library" element={<Library />} />
					<Route path="activity" element={<Activity />} />
					<Route path="channels" element={<Channels />} />
					<Route path="settings" element={<Settings />} />
					{/* Legacy route redirects */}
					<Route path="posts" element={<Navigate to="/library" replace />} />
					<Route path="posts/new" element={<Navigate to="/compose" replace />} />
					<Route path="posts/:id" element={<Navigate to="/library" replace />} />
					<Route path="queue" element={<Navigate to="/activity" replace />} />
					<Route path="platforms" element={<Navigate to="/channels" replace />} />
				</Route>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
