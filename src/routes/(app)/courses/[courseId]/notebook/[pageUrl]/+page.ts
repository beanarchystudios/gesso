import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';

export function load({ params, url }) {
	const href = resolve('/(app)/courses/[courseId]/pages/[pageId]', {
		courseId: params.courseId,
		pageId: params.pageUrl
	});
	redirect(308, `${href}${url.search}`);
}
