import { resolve } from '$app/paths';

export { getCourseTabShortcut } from './course-shortcuts';

export function getCourseTabHref(
	tab: { id: string; href: string; label?: string },
	courseId: string
): string {
	const label = (tab.label ?? '').toLowerCase();
	if (tab.id === 'home') return resolve('/(app)/courses/[courseId]', { courseId });
	if (tab.id === 'modules') return resolve('/(app)/courses/[courseId]/modules', { courseId });
	if (tab.id === 'announcements')
		return resolve('/(app)/courses/[courseId]/announcements', { courseId });
	if (tab.id === 'assignments')
		return resolve('/(app)/courses/[courseId]/assignments', { courseId });
	if (tab.id === 'discussion_topics' || tab.id === 'discussions')
		return resolve('/(app)/courses/[courseId]/discussions', { courseId });
	if (tab.id === 'people' || tab.id === 'roster')
		return resolve('/(app)/courses/[courseId]/people', { courseId });
	if (tab.id === 'collaborations' || label.includes('collaborat'))
		return resolve('/(app)/courses/[courseId]/collaborations', { courseId });
	if (tab.id === 'pages' || tab.id === 'wiki' || label.includes('notebook'))
		return resolve('/(app)/courses/[courseId]/pages', { courseId });
	if (tab.id === 'syllabus') return resolve('/(app)/courses/[courseId]/syllabus', { courseId });
	if (tab.id === 'grades') return resolve('/(app)/courses/[courseId]/grades', { courseId });
	if (tab.id === 'files')
		return resolve('/(app)/courses/[courseId]/files/[[folderId]]', { courseId });
	if (tab.id === 'chat' || label.includes('chat'))
		return resolve('/(app)/courses/[courseId]/chat', { courseId });
	if (tab.id.startsWith('context_external_tool_')) {
		if (label.includes('notebook')) return resolve('/(app)/courses/[courseId]/pages', { courseId });
		if (label.includes('collaborat'))
			return resolve('/(app)/courses/[courseId]/collaborations', { courseId });
		if (label.includes('chat')) return resolve('/(app)/courses/[courseId]/chat', { courseId });
	}
	return tab.href;
}

export function isCourseTabActive(
	tab: { id: string; label?: string },
	active: string | null
): boolean {
	if (!active) return false;
	if (tab.id === active) return true;
	const label = (tab.label ?? '').toLowerCase();
	if (active === 'pages' && (tab.id === 'pages' || tab.id === 'wiki' || label.includes('notebook')))
		return true;
	if (active === 'collaborations' && label.includes('collaborat')) return true;
	if (active === 'chat' && label.includes('chat')) return true;
	if (active === 'discussions' && (tab.id === 'discussion_topics' || label.includes('discussion')))
		return true;
	if (tab.id.startsWith('context_external_tool_') && label.includes(active.toLowerCase()))
		return true;
	return false;
}

export function getActiveCourseTabId(courseId: string, pathname: string): string | null {
	if (!courseId) return null;
	const base = resolve('/(app)/courses/[courseId]', { courseId });
	if (pathname === base || pathname === `${base}/`) return 'home';
	if (pathname.startsWith(`${base}/`)) {
		const rest = pathname.slice(`${base}/`.length);
		const segment = rest.split('/')[0];
		return segment || 'home';
	}
	return null;
}
