import type { EntityTable } from 'dexie';
import { createDexie, type CacheEntry } from './db';

export const CACHE_VERSION = 3;
export const FRESH_FOR = 5 * 60 * 1000;
export const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const canvasDb = createDexie<{ responses: EntityTable<CacheEntry, 'key'> }>('gesso-canvas', {
	responses: '&key, updatedAt'
});

const inflight = new Map<string, Promise<unknown>>();

async function refresh<T>(db: typeof canvasDb, key: string, fetcher: () => Promise<T>): Promise<T> {
	const existing = inflight.get(key) as Promise<T> | undefined;
	if (existing) return existing;

	const request = fetcher()
		.then(async (value) => {
			try {
				await db?.responses.put({ key, value, updatedAt: Date.now() });
			} catch {
				// IndexedDB can be unavailable in private browsing or when storage is full.
			}
			return value;
		})
		.finally(() => inflight.delete(key));

	inflight.set(key, request);
	return request;
}

/**
 * Stale-while-revalidate cache.
 * - No entry → fetch and cache
 * - Fresh (< FRESH_FOR) → return cached
 * - Stale but not expired (< MAX_AGE) → return cached + revalidate in background
 * - Expired → fetch fresh
 */
export async function cached<T>(
	key: string,
	fetcher: () => Promise<T>,
	options: { version?: number; freshFor?: number; maxAge?: number } = {}
): Promise<T> {
	const version = options.version ?? CACHE_VERSION;
	const freshFor = options.freshFor ?? FRESH_FOR;
	const maxAge = options.maxAge ?? MAX_AGE;

	if (!canvasDb) return fetcher();

	const versionedKey = `${version}:${key}`;
	let entry: CacheEntry<T> | undefined;
	try {
		entry = (await canvasDb.responses.get(versionedKey)) as CacheEntry<T> | undefined;
	} catch {
		return fetcher();
	}

	if (!entry) return refresh(canvasDb, versionedKey, fetcher);

	const age = Date.now() - entry.updatedAt;
	if (age <= freshFor) return entry.value;
	if (age <= maxAge) {
		void refresh(canvasDb, versionedKey, fetcher).catch(() => undefined);
		return entry.value;
	}

	return refresh(canvasDb, versionedKey, fetcher);
}

export async function invalidateCanvasCache(keys: string[]): Promise<void> {
	if (!canvasDb) return;
	try {
		for (const key of keys) {
			await canvasDb.responses.delete(`${CACHE_VERSION}:${key}`);
		}
	} catch {
		// ignore
	}
}

export async function clearCanvasCache(): Promise<void> {
	if (canvasDb) await canvasDb.responses.clear();
}
