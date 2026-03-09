// React hook for file access with header-based auth
import { useState, useEffect } from 'react';
import { fileManager } from '../fileManager.js';

/**
 * Hook to get a secure file URL (with header auth, creates blob URL)
 * @param {string} fileId - File ID from sqlite-hub
 * @param {string} fallbackUrl - Proxy URL if direct access unavailable
 * @returns {string|null} Blob URL or fallback
 */
export function useFileUrl(fileId, fallbackUrl) {
	const [url, setUrl] = useState(fallbackUrl);

	useEffect(() => {
		if (!fileId) {
			setUrl(fallbackUrl);
			return;
		}

		let cancelled = false;

		fileManager.getFileUrl(fileId, fallbackUrl).then((resolvedUrl) => {
			if (!cancelled) {
				setUrl(resolvedUrl);
			}
		});

		return () => {
			cancelled = true;
			// Note: We keep blob URLs in cache, don't revoke here
		};
	}, [fileId, fallbackUrl]);

	return url;
}

/**
 * Hook to fetch text content from sqlite-hub with header auth
 * @param {string} fileId - File ID from sqlite-hub
 * @returns {{text: string|null, loading: boolean}} Text content and loading state
 */
export function useFileText(fileId) {
	const [text, setText] = useState(null);
	const [loading, setLoading] = useState(!!fileId);

	useEffect(() => {
		if (!fileId) {
			setText(null);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);

		fileManager.getFileText(fileId).then((content) => {
			if (!cancelled) {
				setText(content);
				setLoading(false);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [fileId]);

	return { text, loading };
}

/**
 * Hook to batch fetch multiple file URLs
 * @param {Array<{id: string, fallback: string}>} files
 * @returns {Map<string, string>} Map of fileId -> url
 */
export function useFileUrls(files) {
	const [urlMap, setUrlMap] = useState(new Map());

	useEffect(() => {
		if (!files || files.length === 0) {
			setUrlMap(new Map());
			return;
		}

		let cancelled = false;

		fileManager.batchGetFileUrls(files).then((resultMap) => {
			if (!cancelled) {
				setUrlMap(resultMap);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [files]);

	return urlMap;
}
