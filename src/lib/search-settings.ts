import { browser } from '$app/environment';
import Dexie, { type EntityTable } from 'dexie';

export interface SearchSettings {
	id: 'search';
	enhancedSearchEnabled: boolean;
	updatedAt: number;
}

const db = browser
	? (new Dexie('gesso-search') as Dexie & {
			settings: EntityTable<SearchSettings, 'id'>;
		})
	: null;

if (db) db.version(1).stores({ settings: '&id, updatedAt' });

const enabledListeners = new Set<(enabled: boolean) => void>();

function notifyEnabledListeners(enabled: boolean) {
	for (const listener of enabledListeners) listener(enabled);
}

export function subscribeEnhancedSearchEnabled(listener: (enabled: boolean) => void) {
	enabledListeners.add(listener);
	return () => enabledListeners.delete(listener);
}

if (browser) {
	window.addEventListener('storage', (event) => {
		if (event.key !== 'gesso:enhancedSearch') return;
		void getEnhancedSearchEnabled().then(notifyEnabledListeners);
	});
}

export async function getSearchSettings(): Promise<SearchSettings | null> {
	if (!db) return null;
	try {
		const entry = await db.settings.get('search');
		return entry ?? null;
	} catch {
		return null;
	}
}

export async function getEnhancedSearchEnabled(): Promise<boolean> {
	const settings = await getSearchSettings();
	return settings?.enhancedSearchEnabled ?? false;
}

export async function setEnhancedSearchEnabled(enabled: boolean): Promise<void> {
	if (!db) throw new Error('Search settings are unavailable');

	await db.settings.put({
		id: 'search',
		enhancedSearchEnabled: enabled,
		updatedAt: Date.now()
	});

	notifyEnabledListeners(enabled);
	// Notify subscribers in other tabs.
	if (browser) {
		try {
			localStorage.setItem('gesso:enhancedSearch', enabled ? '1' : '0');
		} catch {
			// The IndexedDB setting is authoritative, so localStorage failure only affects other tabs.
		}
	}
}
