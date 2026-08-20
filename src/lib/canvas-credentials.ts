import { browser } from '$app/environment';
import Dexie, { type EntityTable } from 'dexie';

export interface CanvasCredentials {
	id: 'canvas';
	instanceUrl: string;
	apiKey: string;
	updatedAt: number;
}

const db = browser
	? (new Dexie('gesso-settings') as Dexie & {
			credentials: EntityTable<CanvasCredentials, 'id'>;
		})
	: null;

if (db) db.version(1).stores({ credentials: '&id, updatedAt' });

function normalizeInstanceUrl(value: string) {
	const url = new URL(value.trim());
	if (url.protocol !== 'https:') throw new Error('Canvas must use an HTTPS URL.');
	if (url.username || url.password)
		throw new Error('Use a Canvas URL without embedded credentials.');
	return url.origin + url.pathname.replace(/\/$/, '');
}

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
