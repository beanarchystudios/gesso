import { getRequestEvent } from '$app/server';
import { safeCanvasUrl } from './utils/canvas-url';

export const env = new Proxy({} as Record<string, string | undefined>, {
	get(_target, property) {
		const cookies = getRequestEvent().cookies;
		if (property === 'CANVAS_API_KEY') return cookies.get('gesso_canvas_key');
		if (property === 'CANVAS_INSTANCE_URL') return safeCanvasUrl(cookies.get('gesso_canvas_url'));
		return undefined;
	}
});
