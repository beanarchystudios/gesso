import { browser } from '$app/environment';
import type { EntityTable } from 'dexie';
import { createDexie } from './db';
import { normalizeInstanceUrl } from './utils/canvas-url';
import type { CanvasCredentials } from './canvas/credentials-types';

export type { CanvasCredentials } from './canvas/credentials-types';

const db = createDexie<{ credentials: EntityTable<CanvasCredentials, 'id'> }>('gesso-settings', {
	credentials: '&id, updatedAt'
});

function setBridgeCookies(credentials: CanvasCredentials | null) {
	if (!browser) return;
	const secure = location.protocol === 'https:' ? '; Secure' : '';
	const options = `; Path=/; SameSite=Strict${secure}`;
	if (!credentials) {
		document.cookie = `gesso_canvas_url=; Max-Age=0${options}`;
		document.cookie = `gesso_canvas_key=; Max-Age=0${options}`;
		return;
	}
	document.cookie = `gesso_canvas_url=${encodeURIComponent(credentials.instanceUrl)}${options}`;
	document.cookie = `gesso_canvas_key=${encodeURIComponent(credentials.apiKey)}${options}`;
}

export async function getCanvasCredentials() {
	const credentials = await db?.credentials.get('canvas');
	if (credentials) setBridgeCookies(credentials);
	return credentials ?? null;
}

export async function saveCanvasCredentials(instanceUrl: string, apiKey: string) {
	const credentials: CanvasCredentials = {
		id: 'canvas',
		instanceUrl: normalizeInstanceUrl(instanceUrl),
		apiKey: apiKey.trim(),
		updatedAt: Date.now()
	};
	if (!credentials.apiKey) throw new Error('Enter your Canvas access token.');
	await db?.credentials.put(credentials);
	setBridgeCookies(credentials);
	return credentials;
}

export async function removeCanvasCredentials() {
	await db?.credentials.delete('canvas');
	setBridgeCookies(null);
}
