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
}

interface CanvasColors {
	custom_colors?: Record<string, string>;
}

interface CanvasPage {
	title?: string;
	body?: string;
}

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
