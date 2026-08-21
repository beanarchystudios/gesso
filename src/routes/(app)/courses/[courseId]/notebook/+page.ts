import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';

export function load({ params }) {
	redirect(308, resolve('/(app)/courses/[courseId]/pages', { courseId: params.courseId }));
}
