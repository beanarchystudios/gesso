import { browser } from '$app/environment';
import Dexie from 'dexie';

export type CacheEntry<T = unknown> = {
	key: string;
	value: T;
	updatedAt: number;
};

/**
 * Create a browser-only Dexie instance safely.
 * Returns null on the server so callers can no-op.
 */
export function createDexie<T extends Record<string, unknown>>(
	name: string,
	stores: Record<string, string>
): (Dexie & T) | null {
	if (!browser) return null;
	const db = new Dexie(name) as Dexie & T;
	db.version(1).stores(stores);
	return db;
}
