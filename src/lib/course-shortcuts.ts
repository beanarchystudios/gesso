import { resolve } from '$app/paths';

export const COURSE_SHORTCUTS = {
	Home: 'h',
	Modules: 'm',
	Assignments: 'a',
	Grades: 'g',
	Announcements: 'n'
} as const;

export type CourseShortcutKey = (typeof COURSE_SHORTCUTS)[keyof typeof COURSE_SHORTCUTS];

export function getCourseShortcutHref(key: CourseShortcutKey, courseId: string) {
	switch (key) {
		case 'h':
			return resolve('/(app)/courses/[courseId]', { courseId });
		case 'm':
			return resolve('/(app)/courses/[courseId]/modules', { courseId });
		case 'a':
			return resolve('/(app)/courses/[courseId]/assignments', { courseId });
		case 'g':
			return resolve('/(app)/courses/[courseId]/grades', { courseId });
		case 'n':
			return resolve('/(app)/courses/[courseId]/announcements', { courseId });
	}
}

export function getCourseTabShortcut(tab: { id: string; label?: string }) {
	const label = tab.label?.toLowerCase();
	if (tab.id === 'home') return COURSE_SHORTCUTS.Home;
	if (tab.id === 'modules') return COURSE_SHORTCUTS.Modules;
	if (tab.id === 'assignments') return COURSE_SHORTCUTS.Assignments;
	if (tab.id === 'grades') return COURSE_SHORTCUTS.Grades;
	if (tab.id === 'announcements') return COURSE_SHORTCUTS.Announcements;

	if (label === 'home') return COURSE_SHORTCUTS.Home;
	if (label === 'modules') return COURSE_SHORTCUTS.Modules;
	if (label === 'assignments') return COURSE_SHORTCUTS.Assignments;
	if (label === 'grades') return COURSE_SHORTCUTS.Grades;
	if (label === 'announcements') return COURSE_SHORTCUTS.Announcements;

	return undefined;
}
