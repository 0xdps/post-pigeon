// Example component showing header-based auth file access
import { useFileUrl, useFileUrls } from '../hooks/useFileUrl.js';

/**
 * Example 1: Single image with header-based auth
 */
export function SecureImage({ fileId, fallbackUrl, alt, className }) {
	const url = useFileUrl(fileId, fallbackUrl);
	
	return <img src={url} alt={alt} className={className} />;
}

/**
 * Example 2: Multiple images (batch fetch)
 */
export function SecureImageGallery({ images }) {
	const files = images.map(img => ({
		id: img.file_id,
		fallback: img.url,
	}));
	
	const urlMap = useFileUrls(files);
	
	return (
		<div className="grid grid-cols-3 gap-4">
			{images.map((img) => (
				<img
					key={img.id}
					src={urlMap.get(img.file_id) || img.url}
					alt={img.filename}
					className="w-full h-32 object-cover rounded"
				/>
			))}
		</div>
	);
}

/**
 * Example 3: Direct usage in existing components
 * 
 * Before:
 * <img src={image.url} alt={image.filename} />
 * 
 * After:
 * const imageUrl = useFileUrl(image.file_id, image.url);
 * <img src={imageUrl} alt={image.filename} />
 */
