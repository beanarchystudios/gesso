import { browser } from '$app/environment';
import { resolve } from '$app/paths';
import type { create } from '@orama/orama';
import {
	getCalendarEvents,
	getCourseAnnouncements,
	getCourseAssignments,
	getCourseCollaborations,
	getCourseDetails,
	getCourseDiscussions,
	getCourseFiles,
	getCourseFrontPage,
	getCourseGrades,
	getCourseModules,
	getCoursePages,
	getCoursePageBodies,
	getCoursePeople,
	getCourses,
	getConversations
} from './canvas';
import { stripHtml } from './utils/html';

export type SearchDocumentType =
	| 'course'
	| 'assignment'
	| 'announcement'
	| 'discussion'
	| 'person'
	| 'module'
	| 'module_item'
	| 'page'
	| 'file'
	| 'collaboration'
	| 'conversation'
	| 'calendar_event'
	| 'grade'
	| 'navigation';

export interface SearchDocument {
	id: string;
	canonicalId?: string;
	title: string;
	description: string;
	type: SearchDocumentType;
	courseId: string;
	courseName: string;
	href: string;
	meta: string;
	term: string;
}

const searchSchema = {
	id: 'string',
	canonicalId: 'string',
	title: 'string',
	description: 'string',
	type: 'string',
	courseId: 'string',
	courseName: 'string',
	href: 'string',
	meta: 'string',
	term: 'string'
} as const;

type OramaInstance = Awaited<ReturnType<typeof create<typeof searchSchema>>>;

let indexingPromise: Promise<OramaInstance> | null = null;
let currentDb: OramaInstance | null = null;
let indexGeneration = 0;

export type IndexingStatus = 'idle' | 'indexing' | 'ready' | 'partial' | 'error';

let status: IndexingStatus = 'idle';
let statusMessage = '';
let documentCount = 0;
const statusListeners = new Set<() => void>();

function notifyStatus() {
	for (const cb of statusListeners) cb();
}

function assertCurrentGeneration(generation: number) {
	if (generation !== indexGeneration) throw new Error('Search indexing was cancelled');
}

function updateIndexingMessage(generation: number, message: string) {
	assertCurrentGeneration(generation);
	statusMessage = message;
	notifyStatus();
}

export function subscribeStatus(cb: () => void) {
	statusListeners.add(cb);
	return () => statusListeners.delete(cb);
}

export function getIndexingStatus() {
	return { status, message: statusMessage, count: documentCount };
}

function toCourseHref(courseId: number | string) {
	return `/courses/${courseId}`;
}

function withQuery(href: string, query: string) {
	return `${href}?q=${encodeURIComponent(query)}`;
}

function toAssignmentHref(courseId: number | string, assignmentId: number | string) {
	return resolve('/(app)/courses/[courseId]/assignments/[assignmentId]', {
		courseId: String(courseId),
		assignmentId: String(assignmentId)
	});
}

function assignmentIdFromCanvasUrl(href: string | null) {
	return href?.match(/\/courses\/\d+\/assignments\/(\d+)/)?.[1] ?? null;
}

function moduleItemCanonicalId(
	courseId: string,
	item: { id: number; type: string; contentId: number | null }
) {
	if (item.contentId == null) return `module-item:${courseId}:${item.id}`;

	switch (item.type.toLocaleLowerCase()) {
		case 'assignment':
			return `assignment:${courseId}:${item.contentId}`;
		case 'discussion':
			return `discussion:${courseId}:${item.contentId}`;
		default:
			return `module-${item.type.toLocaleLowerCase()}:${courseId}:${item.contentId}`;
	}
}

async function createDb(): Promise<OramaInstance> {
	const { create } = await import('@orama/orama');
	return create({
		schema: searchSchema
	});
}

export async function ensureSearchIndex(): Promise<OramaInstance> {
	if (!browser) throw new Error('Search is browser-only');
	if (currentDb) return currentDb;
	if (indexingPromise) return indexingPromise;
	return rebuildSearchIndex();
}

export async function rebuildSearchIndex(): Promise<OramaInstance> {
	if (!browser) throw new Error('Search is browser-only');
	if (indexingPromise) return indexingPromise;

	const generation = ++indexGeneration;
	const buildPromise = (async () => {
		status = 'indexing';
		statusMessage = 'Loading courses…';
		documentCount = 0;
		notifyStatus();

		const db = await createDb();
		assertCurrentGeneration(generation);
		const docs: SearchDocument[] = [];
		const failures: string[] = [];

		// static navigation items - always searchable
		const navItems: SearchDocument[] = [
			{
				id: 'nav-dashboard',
				title: 'Dashboard',
				description: 'Overview of your courses and activity',
				type: 'navigation',
				courseId: '',
				courseName: '',
				href: '/dashboard',
				meta: 'navigation',
				term: 'dashboard'
			},
			{
				id: 'nav-courses',
				title: 'Courses',
				description: 'Browse all your courses',
				type: 'navigation',
				courseId: '',
				courseName: '',
				href: '/courses',
				meta: 'navigation',
				term: ''
			},
			{
				id: 'nav-calendar',
				title: 'Calendar',
				description: 'View calendar events and deadlines',
				type: 'navigation',
				courseId: '',
				courseName: '',
				href: '/calendar',
				meta: 'navigation',
				term: ''
			},
			{
				id: 'nav-inbox',
				title: 'Inbox',
				description: 'Conversations and messages',
				type: 'navigation',
				courseId: '',
				courseName: '',
				href: '/inbox',
				meta: 'navigation',
				term: ''
			},
			{
				id: 'nav-notebook',
				title: 'Notebook',
				description: 'Personal notes on this device',
				type: 'navigation',
				courseId: '',
				courseName: '',
				href: '/notebook',
				meta: 'navigation',
				term: ''
			},
			{
				id: 'nav-account',
				title: 'Account',
				description: 'Manage account and connection',
				type: 'navigation',
				courseId: '',
				courseName: '',
				href: '/account',
				meta: 'navigation',
				term: ''
			}
		];
		docs.push(...navItems);

		const courses = await getCourses();
		assertCurrentGeneration(generation);

		// Only index currently enrolled courses — skip completed/previous and untitled
		const enrolledCourses = courses.filter(
			(c) => c.name !== 'Untitled course' && !c.previous && c.enrolled
		);

		for (const course of enrolledCourses) {
			docs.push({
				id: `course-${course.id}`,
				title: course.name,
				description: `${course.code} ${course.term}`,
				type: 'course',
				courseId: String(course.id),
				courseName: course.name,
				href: toCourseHref(course.id),
				meta: course.term,
				term: course.term
			});
		}

		updateIndexingMessage(generation, `Indexing ${enrolledCourses.length} courses…`);

		// Per-course indexing - fetch in parallel per course, but sequentially across courses to avoid thundering herd
		let indexedCourses = 0;
		for (const course of enrolledCourses) {
			assertCurrentGeneration(generation);
			const courseId = String(course.id);
			const courseName = course.name;
			const baseHref = toCourseHref(course.id);
			const perCourse: SearchDocument[] = [];

			const results = await Promise.allSettled([
				getCourseAssignments(courseId),
				getCourseAnnouncements(courseId),
				getCourseDiscussions(courseId),
				getCoursePeople(courseId),
				getCourseModules(courseId),
				getCoursePages(courseId),
				getCourseFiles(courseId),
				getCourseCollaborations(courseId),
				getCourseDetails(courseId),
				getCourseGrades(courseId),
				getCourseFrontPage(courseId)
			]);
			assertCurrentGeneration(generation);

			const [
				assignmentsRes,
				announcementsRes,
				discussionsRes,
				peopleRes,
				modulesRes,
				pagesRes,
				filesRes,
				collaborationsRes,
				detailsRes,
				gradesRes,
				frontPageRes
			] = results;
			const resultNames = [
				'assignments',
				'announcements',
				'discussions',
				'people',
				'modules',
				'pages',
				'files',
				'collaborations',
				'course details',
				'grades',
				'front page'
			];
			results.forEach((result, index) => {
				if (result.status === 'rejected') failures.push(`${courseName}: ${resultNames[index]}`);
			});

			if (assignmentsRes.status === 'fulfilled' && Array.isArray(assignmentsRes.value)) {
				for (const a of assignmentsRes.value) {
					perCourse.push({
						id: `assignment-${courseId}-${a.id}`,
						canonicalId: `assignment:${courseId}:${a.id}`,
						title: a.name,
						description: stripHtml(a.description),
						type: 'assignment',
						courseId,
						courseName,
						href: `${baseHref}/assignments/${a.id}`,
						meta: a.dueAt
							? `Due ${new Date(a.dueAt).toLocaleDateString()}`
							: a.pointsPossible
								? `${a.pointsPossible} pts`
								: '',
						term: ''
					});
				}
			}

			if (announcementsRes.status === 'fulfilled' && Array.isArray(announcementsRes.value)) {
				for (const ann of announcementsRes.value) {
					perCourse.push({
						id: `announcement-${courseId}-${ann.id}`,
						title: ann.title,
						description: stripHtml(ann.message),
						type: 'announcement',
						courseId,
						courseName,
						href: withQuery(`${baseHref}/announcements`, ann.title),
						meta: ann.authorName ? `By ${ann.authorName}` : '',
						term: ''
					});
				}
			}

			if (discussionsRes.status === 'fulfilled' && Array.isArray(discussionsRes.value)) {
				for (const d of discussionsRes.value) {
					perCourse.push({
						id: `discussion-${courseId}-${d.id}`,
						canonicalId: `discussion:${courseId}:${d.id}`,
						title: d.title,
						description: stripHtml(d.message),
						type: 'discussion',
						courseId,
						courseName,
						href: withQuery(`${baseHref}/discussions`, d.title),
						meta: d.authorName ? `By ${d.authorName}` : '',
						term: ''
					});
				}
			}

			if (peopleRes.status === 'fulfilled' && Array.isArray(peopleRes.value)) {
				for (const p of peopleRes.value) {
					perCourse.push({
						id: `person-${courseId}-${p.id}`,
						title: p.name,
						description: `${p.role ?? ''} ${p.email ?? ''} ${p.loginId ?? ''}`.trim(),
						type: 'person',
						courseId,
						courseName,
						href: withQuery(`${baseHref}/people`, p.name),
						meta: p.role ?? '',
						term: ''
					});
				}
			}

			if (modulesRes.status === 'fulfilled' && Array.isArray(modulesRes.value)) {
				for (const m of modulesRes.value) {
					perCourse.push({
						id: `module-${courseId}-${m.id}`,
						title: m.name,
						description: `Module • ${m.itemsCount} items`,
						type: 'module',
						courseId,
						courseName,
						href: withQuery(`${baseHref}/modules`, m.name),
						meta: m.state,
						term: ''
					});
					for (const item of m.items ?? []) {
						const assignmentHref =
							item.contentId != null && item.type.toLocaleLowerCase().includes('assign')
								? toAssignmentHref(courseId, item.contentId)
								: null;
						const pageHref =
							item.contentId != null || item.pageUrl
								? resolve('/(app)/courses/[courseId]/pages/[pageId]', {
										courseId,
										pageId: String(item.contentId ?? item.pageUrl)
									})
								: null;
						perCourse.push({
							id: `module_item-${courseId}-${m.id}-${item.id}`,
							canonicalId: moduleItemCanonicalId(courseId, item),
							title: item.title,
							description: `${item.type} • ${m.name}`,
							type: 'module_item',
							courseId,
							courseName,
							href:
								assignmentHref ??
								pageHref ??
								item.htmlUrl ??
								withQuery(`${baseHref}/modules`, item.title),
							meta: item.type,
							term: ''
						});
					}
				}
			}

			if (pagesRes.status === 'fulfilled' && Array.isArray(pagesRes.value)) {
				let pageBodies: Record<string, string> = {};
				try {
					const pageContent = await getCoursePageBodies(
						courseId,
						pagesRes.value.map((page) => page.url)
					);
					pageBodies = pageContent.bodies;
					if (pageContent.failed > 0)
						failures.push(`${courseName}: ${pageContent.failed} page bodies`);
					assertCurrentGeneration(generation);
				} catch {
					assertCurrentGeneration(generation);
					failures.push(`${courseName}: page content`);
				}
				for (const p of pagesRes.value) {
					perCourse.push({
						id: `page-${courseId}-${p.id ?? p.url}`,
						title: p.title,
						description: stripHtml(pageBodies[p.url]) || (p.frontPage ? 'Front page' : 'Page'),
						type: 'page',
						courseId,
						courseName,
						href: resolve('/(app)/courses/[courseId]/pages/[pageId]', {
							courseId,
							pageId: String(p.id ?? p.url)
						}),
						meta: p.published ? '' : 'Unpublished',
						term: ''
					});
				}
			}

			if (filesRes.status === 'fulfilled' && filesRes.value) {
				const { folders, files } = filesRes.value;
				const folderPath = (folderId: number | null) => {
					const names: string[] = [];
					let current = folderId;
					const seen = new Set<number>();
					while (current != null && !seen.has(current)) {
						seen.add(current);
						const folder = folders.find((item) => item.id === current);
						if (!folder) break;
						if (folder.parentId != null) names.unshift(folder.name);
						current = folder.parentId;
					}
					return names.join(' / ');
				};
				for (const folder of folders) {
					if (folder.parentId == null) continue;
					perCourse.push({
						id: `folder-${courseId}-${folder.id}`,
						title: folder.name,
						description: folderPath(folder.parentId) || 'Folder',
						type: 'file',
						courseId,
						courseName,
						href: resolve('/(app)/courses/[courseId]/files/[[folderId]]', {
							courseId,
							folderId: String(folder.id)
						}),
						meta: 'Folder',
						term: ''
					});
				}
				for (const file of files) {
					perCourse.push({
						id: `file-${courseId}-${file.id}`,
						title: file.name,
						description: folderPath(file.folderId) || 'File',
						type: 'file',
						courseId,
						courseName,
						href: withQuery(
							resolve('/(app)/courses/[courseId]/files/[[folderId]]', {
								courseId,
								folderId: String(file.folderId)
							}),
							file.name
						),
						meta: 'File',
						term: ''
					});
				}
			}

			if (collaborationsRes.status === 'fulfilled' && Array.isArray(collaborationsRes.value)) {
				for (const c of collaborationsRes.value) {
					perCourse.push({
						id: `collaboration-${courseId}-${c.id}`,
						title: c.title,
						description: c.type,
						type: 'collaboration',
						courseId,
						courseName,
						href: withQuery(`${baseHref}/collaborations`, c.title),
						meta: c.type,
						term: ''
					});
				}
			}

			// Details: syllabus body could be large, index as meta? Use description stripped
			if (detailsRes.status === 'fulfilled') {
				const details = detailsRes.value as Awaited<ReturnType<typeof getCourseDetails>>;
				if (details?.syllabusBody) {
					perCourse.push({
						id: `syllabus-${courseId}`,
						title: `${courseName} Syllabus`,
						description: stripHtml(details.syllabusBody),
						type: 'page',
						courseId,
						courseName,
						href: `${baseHref}/syllabus`,
						meta: 'Syllabus',
						term: ''
					});
				}
			}

			if (gradesRes.status === 'fulfilled' && Array.isArray(gradesRes.value)) {
				for (const g of gradesRes.value) {
					perCourse.push({
						id: `grade-${courseId}-${g.assignmentId}`,
						title: g.name,
						description: g.grade
							? `Grade ${g.grade} • ${g.score ?? ''}/${g.pointsPossible ?? ''}`
							: stripHtml(''),
						type: 'grade',
						courseId,
						courseName,
						href: toAssignmentHref(courseId, g.assignmentId),
						meta: g.score != null ? `${g.score}/${g.pointsPossible ?? ''}` : (g.grade ?? ''),
						term: ''
					});
				}
			}

			if (frontPageRes.status === 'fulfilled') {
				const front = frontPageRes.value as Awaited<ReturnType<typeof getCourseFrontPage>>;
				if (front?.body) {
					perCourse.push({
						id: `frontpage-${courseId}`,
						title: front.title ?? `${courseName} Home`,
						description: stripHtml(front.body),
						type: 'page',
						courseId,
						courseName,
						href: baseHref,
						meta: 'Front page',
						term: ''
					});
				}
			}

			docs.push(...perCourse);
			indexedCourses += 1;
			if (indexedCourses % 2 === 0 || indexedCourses === enrolledCourses.length) {
				updateIndexingMessage(
					generation,
					`Indexing courses ${indexedCourses}/${enrolledCourses.length}…`
				);
			}
		}

		// conversations
		try {
			updateIndexingMessage(generation, 'Indexing conversations…');
			const convs = await getConversations();
			assertCurrentGeneration(generation);
			for (const c of convs) {
				const participantNames = (c.participants ?? []).map((p) => p.name).join(', ');
				docs.push({
					id: `conversation-${c.id}`,
					title: c.subject,
					description: `${stripHtml(c.lastMessage)} ${participantNames}`.trim(),
					type: 'conversation',
					courseId: '',
					courseName: c.contextName ?? '',
					href: `/inbox?conversation=${encodeURIComponent(String(c.id))}`,
					meta: participantNames.slice(0, 80),
					term: ''
				});
			}
		} catch {
			assertCurrentGeneration(generation);
			failures.push('conversations');
		}

		// calendar events
		try {
			updateIndexingMessage(generation, 'Indexing calendar…');
			const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
			const end = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
			const events = await getCalendarEvents({ start, end });
			assertCurrentGeneration(generation);
			for (const e of events) {
				const assignmentId =
					e.type.toLocaleLowerCase().includes('assignment') && e.courseId
						? e.source === 'planner'
							? e.rawId
							: assignmentIdFromCanvasUrl(e.htmlUrl)
						: null;
				docs.push({
					id: e.id,
					title: e.title,
					description: stripHtml(e.description),
					type: 'calendar_event',
					courseId: e.courseId ?? '',
					courseName: e.contextName ?? e.courseId ?? '',
					href:
						assignmentId && e.courseId
							? toAssignmentHref(e.courseId, assignmentId)
							: (e.htmlUrl ?? (e.courseId ? `/courses/${e.courseId}` : '/calendar')),
					meta: e.start ? new Date(e.start).toLocaleDateString() : e.type,
					term: e.type
				});
			}
		} catch {
			assertCurrentGeneration(generation);
			failures.push('calendar');
		}

		// Insert all at once
		if (docs.length > 0) {
			const { insertMultiple } = await import('@orama/orama');
			assertCurrentGeneration(generation);
			// Orama has limit per insertMultiple, chunk
			const chunkSize = 1000;
			for (let i = 0; i < docs.length; i += chunkSize) {
				const chunk = docs.slice(i, i + chunkSize).map((d) => ({
					...d,
					// ensure all fields are strings
					canonicalId: d.canonicalId ?? d.id,
					courseId: d.courseId ?? '',
					courseName: d.courseName ?? '',
					term: d.term ?? '',
					meta: d.meta ?? ''
				}));
				await insertMultiple(db, chunk);
				assertCurrentGeneration(generation);
			}
		}

		if (generation !== indexGeneration) {
			throw new Error('Search indexing was cancelled');
		}

		currentDb = db;
		status = 'ready';
		statusMessage = '';
		documentCount = docs.length;
		notifyStatus();
		return db;
	})();
	indexingPromise = buildPromise;

	try {
		const result = await buildPromise;
		return result;
	} catch (err) {
		if (generation === indexGeneration) {
			status = 'error';
			statusMessage = err instanceof Error ? err.message : 'Indexing failed';
			notifyStatus();
		}
		throw err;
	} finally {
		if (indexingPromise === buildPromise) indexingPromise = null;
	}
}

export async function searchDocuments(term: string, limit = 30) {
	const db = await ensureSearchIndex();
	const { search } = await import('@orama/orama');
	const trimmed = term.trim();
	if (!trimmed) {
		// return recent/top items grouped? For empty query, return courses + navigation + upcoming events
		const result = await search(db, {
			term: '',
			limit,
			threshold: 1
		});
		// fallback when empty term returns nothing: just fetch via search with boost? Or return empty.
		// Better: use search with empty should return nothing, so we fallback to showing all types limited
		if (result.hits.length === 0) {
			// do a wildcard search via brute force: fetch first N via search with limit and no term? Orama requires term.
			// Return empty for now; caller can handle empty state
			return [];
		}
		return result.hits.map((h) => ({ document: h.document as SearchDocument, score: h.score }));
	}

	const result = await search(db, {
		term: trimmed,
		properties: ['title', 'description', 'courseName', 'meta', 'term'],
		boost: {
			title: 3,
			courseName: 1.5
		},
		limit,
		tolerance: 1,
		threshold: 0
	});

	return result.hits.map((h) => ({ document: h.document as SearchDocument, score: h.score }));
}

export function clearSearchIndex() {
	indexGeneration += 1;
	indexingPromise = null;
	currentDb = null;
	status = 'idle';
	statusMessage = '';
	documentCount = 0;
	notifyStatus();
}
