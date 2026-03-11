import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Scheduled from "./pages/Scheduled.jsx";
import Settings from "./pages/Settings.jsx";
import Posts from "./pages/Posts.jsx";
import PostEditor from "./pages/PostEditor.jsx";
import Platforms from "./pages/Platforms.jsx";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/login" element={<Login />} />
				<Route path="/" element={<Layout />}>
					<Route index element={<Dashboard />} />
				<Route path="queue" element={<Scheduled />} />
				<Route path="platforms" element={<Platforms />} />
					<Route path="settings" element={<Settings />} />
					<Route path="posts" element={<Posts />} />
					<Route path="posts/new" element={<PostEditor />} />
					<Route path="posts/:id" element={<PostEditor />} />
				</Route>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
}
