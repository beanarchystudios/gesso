import { browser } from '$app/environment';
import Dexie, { type EntityTable } from 'dexie';
import {
	getCanvasUser as fetchCanvasUser,
	getCourses as fetchCourses,
	getCourseFrontPage as fetchCourseFrontPage,
	getCourseTabs as fetchCourseTabs,
	getFavoriteCourses as fetchFavoriteCourses
} from './canvas.remote';

interface CacheEntry<T = unknown> {
	key: string;
	value: T;
	updatedAt: number;
}

const CACHE_VERSION = 2;
const FRESH_FOR = 5 * 60 * 1000;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const db = browser
	? (new Dexie('gesso-canvas') as Dexie & { responses: EntityTable<CacheEntry, 'key'> })
	: null;

if (db) {
	db.version(1).stores({ responses: '&key, updatedAt' });
}

const requests = new Map<string, Promise<unknown>>();

async function refresh<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
	const existing = requests.get(key) as Promise<T> | undefined;
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
		.finally(() => requests.delete(key));

	requests.set(key, request);
	return request;
}

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
	if (!db) return fetcher();

	const versionedKey = `${CACHE_VERSION}:${key}`;
	let entry: CacheEntry<T> | undefined;
	try {
		entry = (await db.responses.get(versionedKey)) as CacheEntry<T> | undefined;
	} catch {
		return fetcher();
	}

	if (!entry) return refresh(versionedKey, fetcher);

	const age = Date.now() - entry.updatedAt;
	if (age <= FRESH_FOR) return entry.value;
	if (age <= MAX_AGE) {
		void refresh(versionedKey, fetcher).catch(() => undefined);
		return entry.value;
	}

	return refresh(versionedKey, fetcher);
}

export function getCourses() {
	return cached('courses', () => fetchCourses());
}

export function getFavoriteCourses() {
	return cached('favorite-courses', () => fetchFavoriteCourses());
}

export function getCanvasUser() {
	return cached('user', () => fetchCanvasUser());
}

export function getCourseTabs(courseId: string) {
	return cached(`course:${courseId}:tabs`, () => fetchCourseTabs(courseId));
}

export function getCourseFrontPage(courseId: string) {
	return cached(`course:${courseId}:front-page`, () => fetchCourseFrontPage(courseId));
}

export async function clearCanvasCache() {
	if (db) await db.responses.clear();
}
