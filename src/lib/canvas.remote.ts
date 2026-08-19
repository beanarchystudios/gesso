import { env } from '$env/dynamic/private';
import { query } from '$app/server';
import { error } from '@sveltejs/kit';

interface CanvasProfile {
	id?: number;
	name?: string;
	short_name?: string;
	sortable_name?: string;
	avatar_url?: string;
	title?: string | null;
	bio?: string | null;
	primary_email?: string | null;
	login_id?: string | null;
	time_zone?: string | null;
	locale?: string | null;
	effective_locale?: string | null;
	pronouns?: string | null;
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

interface CanvasConversationParticipant {
	id: number;
	name?: string;
	avatar_url?: string | null;
}

interface CanvasConversation {
	id: number;
	subject?: string | null;
	workflow_state?: string;
	last_message?: string | null;
	last_message_at?: string | null;
	last_authored_message_at?: string | null;
	message_count?: number;
	subscribed?: boolean;
	private?: boolean;
	starred?: boolean;
	properties?: string[];
	audience?: number[];
	participants?: CanvasConversationParticipant[];
	avatar_url?: string | null;
	context_code?: string | null;
	context_name?: string | null;
}

interface CanvasConversationMessage {
	id: number;
	body?: string | null;
	created_at?: string | null;
	author_id?: number | null;
	generated?: boolean;
}

interface CanvasSingleConversation extends CanvasConversation {
	messages?: CanvasConversationMessage[];
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

export const getConversations = query(async () => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');

	if (!apiKey || !instanceUrl) {
		error(500, 'Canvas is not configured');
	}

	const headers = { Authorization: `Bearer ${apiKey}` };

	const colorsPromise = fetch(`${instanceUrl}/api/v1/users/self/colors`, { headers })
		.then(async (r) => {
			if (!r.ok) return {} as CanvasColors;
			try {
				return (await r.json()) as CanvasColors;
			} catch {
				return {} as CanvasColors;
			}
		})
		.catch(() => ({}) as CanvasColors);

	// fetch all pages — Canvas caps per_page at 100, inbox can easily exceed 50
	const perPage = '100';
	let page = 1;
	const allConversations: CanvasConversation[] = [];
	while (true) {
		const url = new URL(`${instanceUrl}/api/v1/conversations`);
		url.searchParams.set('per_page', perPage);
		url.searchParams.set('page', String(page));
		url.searchParams.append('include[]', 'participant_avatars');
		url.searchParams.set('scope', 'inbox');

		const res = await fetch(url, { headers });
		if (!res.ok) {
			error(res.status, 'Unable to load Canvas conversations');
		}
		const batch: CanvasConversation[] = await res.json();
		allConversations.push(...batch);

		const link = res.headers.get('Link') ?? res.headers.get('link');
		const hasNext = link ? link.includes('rel="next"') : false;
		if (hasNext) {
			page += 1;
			continue;
		}
		if (batch.length < Number(perPage)) break;
		// fallback when Link header missing: stop when batch < perPage, else continue one more page
		if (batch.length === 0) break;
		page += 1;
		if (page > 20) break; // safety cap ~2000 conversations
	}

	const colors = await colorsPromise;

	const conversations = allConversations;
	return conversations.map((conv) => {
		const participants = (conv.participants ?? []).map((p) => ({
			id: p.id,
			name: p.name ?? 'Unknown',
			avatarUrl: p.avatar_url ?? null
		}));
		const color = conv.context_code ? (colors.custom_colors?.[conv.context_code] ?? null) : null;
		return {
			id: conv.id,
			subject: conv.subject ?? '(No subject)',
			workflowState: conv.workflow_state ?? 'read',
			unread: conv.workflow_state === 'unread',
			starred: conv.starred ?? false,
			messageCount: conv.message_count ?? 1,
			lastMessage: conv.last_message ?? '',
			lastMessageAt: conv.last_message_at ?? conv.last_authored_message_at ?? null,
			participants,
			contextCode: conv.context_code ?? null,
			contextName: conv.context_name ?? null,
			color,
			properties: conv.properties ?? [],
			audience: conv.audience ?? []
		};
	});
});

export const getConversation = query('unchecked', async (conversationId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedId = Number(conversationId);

	if (!apiKey || !instanceUrl) {
		error(500, 'Canvas is not configured');
	}
	if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
		error(400, 'Invalid conversation ID');
	}

	const url = new URL(`${instanceUrl}/api/v1/conversations/${parsedId}`);
	url.searchParams.append('include[]', 'participant_avatars');
	url.searchParams.set('auto_mark_as_read', 'false');

	const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });

	if (!response.ok) {
		error(response.status, 'Unable to load conversation');
	}

	const conv: CanvasSingleConversation = await response.json();
	const participants = (conv.participants ?? []).map((p) => ({
		id: p.id,
		name: p.name ?? 'Unknown',
		avatarUrl: p.avatar_url ?? null
	}));

	const messages = (conv.messages ?? []).map((m) => ({
		id: m.id,
		body: m.body ?? '',
		createdAt: m.created_at ?? null,
		authorId: m.author_id ?? null,
		generated: m.generated ?? false
	}));

	return {
		id: conv.id,
		subject: conv.subject ?? '(No subject)',
		workflowState: conv.workflow_state ?? 'read',
		unread: conv.workflow_state === 'unread',
		messageCount: conv.message_count ?? messages.length,
		participants,
		messages,
		contextCode: conv.context_code ?? null,
		contextName: conv.context_name ?? null,
		properties: conv.properties ?? []
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
		id: profile.id ?? null,
		name: profile.name ?? profile.short_name ?? 'Canvas user',
		shortName: profile.short_name ?? null,
		sortableName: profile.sortable_name ?? null,
		avatarUrl: profile.avatar_url ?? null,
		title: profile.title ?? null,
		bio: profile.bio ?? null,
		primaryEmail: profile.primary_email ?? null,
		loginId: profile.login_id ?? null,
		timeZone: profile.time_zone ?? null,
		locale: profile.locale ?? null,
		effectiveLocale: profile.effective_locale ?? null,
		pronouns: profile.pronouns ?? null,
		profileUrl: `${instanceUrl}/profile`
	};
});
