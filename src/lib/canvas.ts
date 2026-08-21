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
	getCourseFiles as fetchCourseFiles,
	getCoursePages as fetchCoursePages,
	getCoursePage as fetchCoursePage,
	getCoursePageBodies as fetchCoursePageBodies,
	getCoursePeople as fetchCoursePeople,
	getCourses as fetchCourses,
	getCourseFrontPage as fetchCourseFrontPage,
	getCourseGrades as fetchCourseGrades,
	getCourseModules as fetchCourseModules,
	getCourseTabs as fetchCourseTabs,
	getFavoriteCourses as fetchFavoriteCourses
} from './canvas.remote';
import { cached, clearCanvasCache as clearCache, invalidateCanvasCache } from './cache';

export { clearCanvasCache } from './cache';

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

export function getCoursePage(courseId: string, pageId: string) {
	return cached(`course:${courseId}:page:${pageId}`, () => fetchCoursePage({ courseId, pageId }));
}

export function getCoursePageBodies(courseId: string, pageUrls: string[]) {
	return fetchCoursePageBodies({ courseId, pageUrls });
}

export function getCourseFiles(courseId: string) {
	return cached(`course:${courseId}:files`, () => fetchCourseFiles(courseId));
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
		await invalidateCanvasCache([`conversation:${input.conversationId}`, 'conversations']);
		return res;
	});
}

export function updateConversation(input: {
	conversationId: string;
	starred?: boolean;
	workflowState?: 'read' | 'unread' | 'archived';
}) {
	return fetchUpdateConversation(input).then(async (res) => {
		await invalidateCanvasCache([`conversation:${input.conversationId}`, 'conversations']);
		return res;
	});
}

export function bulkUpdateConversations(input: {
	conversationIds: string[];
	workflowState: 'read' | 'unread' | 'archived';
}) {
	return fetchBulkUpdateConversations(input).then(async (res) => {
		await invalidateCanvasCache([
			'conversations',
			...input.conversationIds.map((id) => `conversation:${id}`)
		]);
		return res;
	});
}

export function getCalendarEvents(opts: { start: string; end: string }) {
	const key = `calendar:${opts.start}:${opts.end}`;
	return cached(key, () => fetchCalendarEvents(opts));
}

export async function clearCanvasCacheCompat() {
	await clearCache();
}
