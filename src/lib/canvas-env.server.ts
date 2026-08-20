import { getRequestEvent } from '$app/server';

function safeCanvasUrl(value: string | undefined) {
	if (!value) return undefined;
	try {
		const url = new URL(value);
		const hostname = url.hostname.toLowerCase();
		const privateHost =
			hostname === 'localhost' ||
			hostname === '::1' ||
			hostname.endsWith('.local') ||
			/^127\./.test(hostname) ||
			/^10\./.test(hostname) ||
			/^192\.168\./.test(hostname) ||
			/^169\.254\./.test(hostname) ||
			/^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
			hostname.startsWith('fc') ||
			hostname.startsWith('fd') ||
			hostname.startsWith('fe80:');
		if (url.protocol !== 'https:' || privateHost || url.username || url.password) return undefined;
		return url.origin + url.pathname.replace(/\/$/, '');
	} catch {
		return undefined;
	}
}

export const env = new Proxy({} as Record<string, string | undefined>, {
	get(_target, property) {
		const cookies = getRequestEvent().cookies;
		if (property === 'CANVAS_API_KEY') return cookies.get('gesso_canvas_key');
		if (property === 'CANVAS_INSTANCE_URL') return safeCanvasUrl(cookies.get('gesso_canvas_url'));
		return undefined;
	}
});
