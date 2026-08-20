function isPrivateHostname(hostname: string): boolean {
	const lower = hostname.toLowerCase();
	return (
		lower === 'localhost' ||
		lower === '::1' ||
		lower.endsWith('.local') ||
		/^127\./.test(lower) ||
		/^10\./.test(lower) ||
		/^192\.168\./.test(lower) ||
		/^169\.254\./.test(lower) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(lower) ||
		lower.startsWith('fc') ||
		lower.startsWith('fd') ||
		lower.startsWith('fe80:')
	);
}

/**
 * Normalize a Canvas instance URL: must be HTTPS, no embedded credentials,
 * origin + pathname without trailing slash.
 */
export function normalizeInstanceUrl(value: string): string {
	const url = new URL(value.trim());
	if (url.protocol !== 'https:') throw new Error('Canvas must use an HTTPS URL.');
	if (url.username || url.password)
		throw new Error('Use a Canvas URL without embedded credentials.');
	if (isPrivateHostname(url.hostname)) throw new Error('Private Canvas hosts are not allowed.');
	return url.origin + url.pathname.replace(/\/$/, '');
}

/**
 * Safe parser for cookies/env: returns undefined for missing/invalid/private URLs.
 * Used server-side when reading from cookies where failure should be soft.
 */
export function safeCanvasUrl(value: string | undefined): string | undefined {
	if (!value) return undefined;
	try {
		const url = new URL(value);
		if (
			url.protocol !== 'https:' ||
			isPrivateHostname(url.hostname) ||
			url.username ||
			url.password
		)
			return undefined;
		return url.origin + url.pathname.replace(/\/$/, '');
	} catch {
		return undefined;
	}
}
