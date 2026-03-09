// Example test page for header-based file access
import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { SecureImage } from '../components/SecureImage.jsx';
import { useFileUrl } from '../hooks/useFileUrl.js';

/**
 * Test page showing all three ways to use secure file access:
 * 1. SecureImage component (easiest)
 * 2. useFileUrl hook (manual)
 * 3. fileManager direct (advanced)
 */
export default function FileAccessTest() {
	const [posts, setPosts] = useState([]);
	const [images, setImages] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		try {
			// Load first post with images
			const result = await api.listPosts({ limit: 1 });
			if (result?.posts?.length > 0) {
				const firstPost = result.posts[0];
				setPosts(result.posts);

				// Load images for first post
				const imgResult = await api.listPostImages(firstPost.id);
				if (imgResult?.success) {
					setImages(imgResult.images || []);
				}
			}
		} catch (err) {
			console.error('Failed to load data:', err);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="p-8">
				<p>Loading test data...</p>
			</div>
		);
	}

	return (
		<div className="p-8 max-w-4xl mx-auto space-y-8">
			<div>
				<h1 className="text-2xl font-bold mb-2">File Access Test</h1>
				<p className="text-zinc-400">
					Testing secure header-based file authentication
				</p>
			</div>

			{/* Method 1: SecureImage Component (Recommended) */}
			<section className="space-y-4">
				<h2 className="text-xl font-semibold">
					Method 1: SecureImage Component
				</h2>
				<p className="text-sm text-zinc-400">
					Easiest approach - just pass fileId and fallbackUrl
				</p>
				<div className="grid grid-cols-3 gap-4">
					{images.map((img) => (
						<div key={img.id} className="space-y-2">
							<SecureImage
								fileId={img.file_id}
								fallbackUrl={img.url}
								alt={img.filename}
								className="w-full h-32 object-cover rounded border border-zinc-700"
							/>
							<p className="text-xs text-zinc-500 truncate">
								{img.filename}
							</p>
						</div>
					))}
				</div>
				<div className="text-xs text-zinc-600 font-mono">
					{`<SecureImage fileId={img.file_id} fallbackUrl={img.url} ... />`}
				</div>
			</section>

			{/* Method 2: useFileUrl Hook */}
			<section className="space-y-4">
				<h2 className="text-xl font-semibold">Method 2: useFileUrl Hook</h2>
				<p className="text-sm text-zinc-400">
					More control - manually handle the URL
				</p>
				<div className="grid grid-cols-3 gap-4">
					{images.map((img) => (
						<ImageWithHook key={img.id} image={img} />
					))}
				</div>
				<div className="text-xs text-zinc-600 font-mono">
					{`const url = useFileUrl(img.file_id, img.url);`}
					<br />
					{`<img src={url} ... />`}
				</div>
			</section>

			{/* Info Box */}
			<section className="p-4 bg-zinc-800/50 rounded border border-zinc-700 space-y-2">
				<h3 className="font-semibold">How it works:</h3>
				<ul className="text-sm text-zinc-400 space-y-1 list-disc list-inside">
					<li>
						Dashboard requests session token from <code>/api/posts/files/session</code>
					</li>
					<li>Token stored in memory (30-day expiry, read-only)</li>
					<li>
						Files fetched with <code>Authorization: Bearer {'{token}'}</code> header
					</li>
					<li>Blob URLs created from responses (cached)</li>
					<li>Graceful fallback to proxy if direct access fails</li>
				</ul>
			</section>

			{images.length === 0 && (
				<div className="text-center py-8 text-zinc-500">
					No images found. Upload some images to a post first.
				</div>
			)}
		</div>
	);
}

// Example using useFileUrl hook directly
function ImageWithHook({ image }) {
	const url = useFileUrl(image.file_id, image.url);

	return (
		<div className="space-y-2">
			<img
				src={url}
				alt={image.filename}
				className="w-full h-32 object-cover rounded border border-zinc-700"
			/>
			<p className="text-xs text-zinc-500 truncate">{image.filename}</p>
		</div>
	);
}
