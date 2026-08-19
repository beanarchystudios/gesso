import { env } from '$env/dynamic/private';
import { query } from '$app/server';
import { error } from '@sveltejs/kit';

interface CanvasProfile {
	name?: string;
	short_name?: string;
	avatar_url?: string;
}

interface CanvasCourse {
	id: number;
	name?: string;
	course_code?: string;
	image_download_url?: string;
	workflow_state?: string;
	is_favorite?: boolean;
	term?: { name?: string };
}

interface CanvasColors {
	custom_colors?: Record<string, string>;
}

interface CanvasPage {
	title?: string;
	body?: string;
}

interface CanvasTab {
	id: string;
	label?: string;
	html_url?: string;
	position?: number;
	type?: string;
}

export const getCourses = query(async () => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');

	if (!apiKey || !instanceUrl) {
		error(500, 'Canvas is not configured');
	}

	const courseUrl = (enrollmentState: 'active' | 'completed') => {
		const url = new URL(`${instanceUrl}/api/v1/courses`);
		url.searchParams.set('enrollment_state', enrollmentState);
		url.searchParams.set('per_page', '100');
		url.searchParams.append('include[]', 'term');
		url.searchParams.append('include[]', 'course_image');
		url.searchParams.append('include[]', 'favorites');
		return url;
	};

	const headers = { Authorization: `Bearer ${apiKey}` };
	const [activeResponse, completedResponse, colorsResponse] = await Promise.all([
		fetch(courseUrl('active'), { headers }),
		fetch(courseUrl('completed'), { headers }),
		fetch(`${instanceUrl}/api/v1/users/self/colors`, { headers })
	]);
	if (!activeResponse.ok || !completedResponse.ok || !colorsResponse.ok) {
		error(
			[activeResponse, completedResponse, colorsResponse].find((response) => !response.ok)
				?.status ?? 500,
			'Unable to load Canvas courses'
		);
	}

	const [activeCourses, completedCourses, colors]: [CanvasCourse[], CanvasCourse[], CanvasColors] =
		await Promise.all([activeResponse.json(), completedResponse.json(), colorsResponse.json()]);
	return [
		...activeCourses.map((course) => ({ course, previous: false })),
		...completedCourses.map((course) => ({ course, previous: true }))
	].map(({ course, previous }) => ({
		id: course.id,
		name: course.name ?? course.course_code ?? 'Untitled course',
		code: course.course_code ?? '—',
		term: course.term?.name ?? '—',
		status: course.workflow_state ?? 'available',
		imageUrl: course.image_download_url ?? null,
		favorite: course.is_favorite ?? false,
		color: colors.custom_colors?.[`course_${course.id}`] ?? 'currentColor',
		enrolled: !previous,
		previous
	}));
});

export const getFavoriteCourses = query(async () => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');

	if (!apiKey || !instanceUrl) {
		error(500, 'Canvas is not configured');
	}

	const url = new URL(`${instanceUrl}/api/v1/users/self/favorites/courses`);
	url.searchParams.append('include[]', 'course_image');

	const headers = { Authorization: `Bearer ${apiKey}` };
	const [coursesResponse, colorsResponse] = await Promise.all([
		fetch(url, { headers }),
		fetch(`${instanceUrl}/api/v1/users/self/colors`, { headers })
	]);

	if (!coursesResponse.ok) {
		error(coursesResponse.status, 'Unable to load favorite Canvas courses');
	}
	if (!colorsResponse.ok) {
		error(colorsResponse.status, 'Unable to load Canvas course colors');
	}

	const courses: CanvasCourse[] = await coursesResponse.json();
	const colors: CanvasColors = await colorsResponse.json();
	return courses.map((course) => ({
		id: course.id,
		name: course.name ?? course.course_code ?? 'Untitled course',
		imageUrl: course.image_download_url ?? null,
		color: colors.custom_colors?.[`course_${course.id}`] ?? null
	}));
});

export const getCourseTabs = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);

	if (!apiKey || !instanceUrl) {
		error(500, 'Canvas is not configured');
	}
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) {
		error(400, 'Invalid course ID');
	}

	const response = await fetch(`${instanceUrl}/api/v1/courses/${parsedCourseId}/tabs`, {
		headers: { Authorization: `Bearer ${apiKey}` }
	});

	if (!response.ok) {
		error(response.status, 'Unable to load course tabs');
	}

	const tabs: CanvasTab[] = await response.json();
	return tabs
		.filter((tab) => tab.type !== 'external' && !tab.id.startsWith('context_external_tool_'))
		.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
		.map((tab) => ({
			id: tab.id,
			label: tab.label ?? tab.id,
			href: tab.html_url ?? `${instanceUrl}/courses/${parsedCourseId}/${tab.id}`
		}));
});

export const getCourseFrontPage = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);

	if (!apiKey || !instanceUrl) {
		error(500, 'Canvas is not configured');
	}
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) {
		error(400, 'Invalid course ID');
	}

	const response = await fetch(`${instanceUrl}/api/v1/courses/${parsedCourseId}/front_page`, {
		headers: { Authorization: `Bearer ${apiKey}` }
	});

	if (!response.ok) {
		error(response.status, 'Unable to load the course front page');
	}

	const frontPage: CanvasPage = await response.json();
	return {
		title: frontPage.title ?? 'Course home',
		body: frontPage.body ?? ''
	};
});

export const getCanvasUser = query(async () => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');

	if (!apiKey || !instanceUrl) {
		error(500, 'Canvas is not configured');
	}

	const response = await fetch(`${instanceUrl}/api/v1/users/self/profile`, {
		headers: { Authorization: `Bearer ${apiKey}` }
	});

	if (!response.ok) {
		error(response.status, 'Unable to load the Canvas user');
	}

	const profile: CanvasProfile = await response.json();
	return {
		name: profile.name ?? profile.short_name ?? 'Canvas user',
		avatarUrl: profile.avatar_url ?? null
	};
});
