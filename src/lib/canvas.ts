import { browser } from '$app/environment';
import Dexie, { type EntityTable } from 'dexie';
import {
	bulkUpdateConversations as fetchBulkUpdateConversations,
	getCalendarEvents as fetchCalendarEvents,
	getCanvasUser as fetchCanvasUser,
	getConversation as fetchConversation,
	getConversations as fetchConversations,
	replyToConversation as fetchReplyToConversation,
	updateConversation as fetchUpdateConversation,
	getCourseAnnouncements as fetchCourseAnnouncements,
	getCourseAssignment as fetchCourseAssignment,
	getCourseAssignments as fetchCourseAssignments,
	getCourseChatLaunch as fetchCourseChatLaunch,
	getCourseCollaborations as fetchCourseCollaborations,
	getCourseDetails as fetchCourseDetails,
	getCourseDiscussions as fetchCourseDiscussions,
	getCoursePages as fetchCoursePages,
	getCoursePageBodies as fetchCoursePageBodies,
	getCoursePeople as fetchCoursePeople,
	getCourses as fetchCourses,
	getCourseFrontPage as fetchCourseFrontPage,
	getCourseGrades as fetchCourseGrades,
	getCourseModules as fetchCourseModules,
	getCourseTabs as fetchCourseTabs,
	getFavoriteCourses as fetchFavoriteCourses
} from './canvas.remote';

interface CacheEntry<T = unknown> {
	key: string;
	value: T;
	updatedAt: number;
}

const CACHE_VERSION = 3;
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

export function getCourseModules(courseId: string) {
	return cached(`course:${courseId}:modules`, () => fetchCourseModules(courseId));
}

export function getCourseAnnouncements(courseId: string) {
	return cached(`course:${courseId}:announcements`, () => fetchCourseAnnouncements(courseId));
}

export function getCourseAssignments(courseId: string) {
	return cached(`course:${courseId}:assignments`, () => fetchCourseAssignments(courseId));
}

export function getCourseGrades(courseId: string) {
	return cached(`course:${courseId}:grades`, () => fetchCourseGrades(courseId));
}

export function getCourseAssignment(courseId: string, assignmentId: string) {
	return cached(`course:${courseId}:assignment:${assignmentId}`, () =>
		fetchCourseAssignment({ courseId, assignmentId })
	);
}

export function getCourseDiscussions(courseId: string) {
	return cached(`course:${courseId}:discussions`, () => fetchCourseDiscussions(courseId));
}

export function getCoursePeople(courseId: string) {
	return cached(`course:${courseId}:people`, () => fetchCoursePeople(courseId));
}

export function getCoursePages(courseId: string) {
	return cached(`course:${courseId}:pages`, () => fetchCoursePages(courseId));
}

export function getCoursePageBodies(courseId: string, pageUrls: string[]) {
	return fetchCoursePageBodies({ courseId, pageUrls });
}

export function getCourseCollaborations(courseId: string) {
	return cached(`course:${courseId}:collaborations`, () => fetchCourseCollaborations(courseId));
}

export function getCourseDetails(courseId: string) {
	return cached(`course:${courseId}:details`, () => fetchCourseDetails(courseId));
}

export function getCourseChatLaunch(courseId: string) {
	return cached(`course:${courseId}:chat-launch`, () => fetchCourseChatLaunch(courseId));
}

export function getConversations() {
	return cached('conversations', () => fetchConversations());
}

export function getConversation(conversationId: string) {
	return cached(`conversation:${conversationId}`, () => fetchConversation(conversationId));
}

export function replyToConversation(input: { conversationId: string; body: string }) {
	return fetchReplyToConversation(input).then(async (res) => {
		try {
			await db?.responses.delete(`${CACHE_VERSION}:conversation:${input.conversationId}`);
			await db?.responses.delete(`${CACHE_VERSION}:conversations`);
		} catch {
			// ignore
		}
		return res;
	});
}

export function updateConversation(input: {
	conversationId: string;
	starred?: boolean;
	workflowState?: 'read' | 'unread' | 'archived';
}) {
	return fetchUpdateConversation(input).then(async (res) => {
		try {
			await db?.responses.delete(`${CACHE_VERSION}:conversation:${input.conversationId}`);
			await db?.responses.delete(`${CACHE_VERSION}:conversations`);
		} catch {
			// ignore
		}
		return res;
	});
}

export function bulkUpdateConversations(input: {
	conversationIds: string[];
	workflowState: 'read' | 'unread' | 'archived';
}) {
	return fetchBulkUpdateConversations(input).then(async (res) => {
		try {
			await db?.responses.delete(`${CACHE_VERSION}:conversations`);
			for (const id of input.conversationIds) {
				await db?.responses.delete(`${CACHE_VERSION}:conversation:${id}`);
			}
		} catch {
			// ignore
		}
		return res;
	});
}

export function getCalendarEvents(opts: { start: string; end: string }) {
	const key = `calendar:${opts.start}:${opts.end}`;
	return cached(key, () => fetchCalendarEvents(opts));
}

export async function clearCanvasCache() {
	if (db) await db.responses.clear();
}
