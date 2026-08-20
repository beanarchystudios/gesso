import { error } from '@sveltejs/kit';
import { env } from '$lib/canvas-env.server';

export function requireCanvasEnv(): { apiKey: string; instanceUrl: string } {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	return { apiKey, instanceUrl };
}

export function parseCourseId(courseId: string): number {
	const parsed = Number(courseId);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) error(400, 'Invalid course ID');
	return parsed;
}

export function parseId(value: string, label: string): number {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) error(400, label);
	return parsed;
}

export function canvasHeaders(apiKey: string): Record<string, string> {
	return { Authorization: `Bearer ${apiKey}` };
}

export function hasNextPage(linkHeader: string | null): boolean {
	if (!linkHeader) return false;
	return linkHeader.includes('rel="next"');
}

/**
 * Generic paginated fetch helper for Canvas API.
 * Handles `Link: <...>; rel="next"` pagination and caps pages.
 */
export async function fetchPaginated<T>(
	baseUrl: URL,
	headers: Record<string, string>,
	options: { perPage?: string; maxPages?: number } = {}
): Promise<T[]> {
	const perPage = options.perPage ?? '100';
	const maxPages = options.maxPages ?? 20;
	const all: T[] = [];
	let page = 1;

	while (true) {
		const url = new URL(baseUrl.toString());
		url.searchParams.set('per_page', perPage);
		url.searchParams.set('page', String(page));

		const res = await fetch(url, { headers });
		if (!res.ok) {
			if (all.length === 0) error(res.status, `Unable to load ${baseUrl.pathname}`);
			break;
		}
		const batch = (await res.json()) as T[];
		if (!Array.isArray(batch)) break;
		all.push(...batch);

		const link = res.headers.get('Link') ?? res.headers.get('link');
		if (hasNextPage(link)) {
			page += 1;
			if (page > maxPages) break;
			continue;
		}
		if (batch.length < Number(perPage)) break;
		if (batch.length === 0) break;
		page += 1;
		if (page > maxPages) break;
	}
	return all;
}

export async function fetchColors(
	instanceUrl: string,
	headers: Record<string, string>
): Promise<import('./types').CanvasColors> {
	try {
		const res = await fetch(`${instanceUrl}/api/v1/users/self/colors`, { headers });
		if (!res.ok) return {};
		return (await res.json()) as import('./types').CanvasColors;
	} catch {
		return {};
	}
}
