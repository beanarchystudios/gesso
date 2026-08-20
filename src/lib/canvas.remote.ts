import { env } from './canvas-env.server';
import { command, query } from '$app/server';
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
	term?: { name?: string; start_at?: string | null; end_at?: string | null };
	start_at?: string | null;
	end_at?: string | null;
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
	const courseDate = (course: CanvasCourse) => {
		const value = course.end_at ?? course.term?.end_at ?? course.start_at ?? course.term?.start_at;
		const timestamp = value ? Date.parse(value) : Number.NaN;
		return Number.isNaN(timestamp) ? 0 : timestamp;
	};
	const recentCompletedCourses = [...completedCourses].sort(
		(a, b) => courseDate(b) - courseDate(a) || b.id - a.id
	);
	return [
		...activeCourses.map((course) => ({ course, previous: false })),
		...recentCompletedCourses.map((course) => ({ course, previous: true }))
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
		.filter((tab) => {
			// Keep Notebook/Collaborations/Chat even when they are external LTI tools
			const label = (tab.label ?? '').toLowerCase();
			if (label.includes('notebook') || label.includes('collaborat') || label.includes('chat'))
				return true;
			return tab.type !== 'external' && !tab.id.startsWith('context_external_tool_');
		})
		.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
		.map((tab) => ({
			id: tab.id,
			label: tab.label ?? tab.id,
			href: tab.html_url ?? `${instanceUrl}/courses/${parsedCourseId}/${tab.id}`
		}));
});

interface CanvasModuleItem {
	id: number;
	title?: string;
	type?: string;
	content_id?: number | null;
	page_url?: string | null;
	html_url?: string | null;
	url?: string | null;
	position?: number;
	indent?: number;
	published?: boolean;
	completion_requirement?: {
		type?: string;
		completed?: boolean;
		min_score?: number | null;
	} | null;
	content_details?: {
		points_possible?: number | null;
		due_at?: string | null;
		locked_for_user?: boolean | null;
		unlock_at?: string | null;
		hidden?: boolean | null;
	} | null;
}

interface CanvasModule {
	id: number;
	name?: string;
	position?: number;
	state?: string;
	unlock_at?: string | null;
	require_sequential_progress?: boolean;
	prerequisite_module_ids?: number[];
	items_count?: number;
	items_url?: string;
	items?: CanvasModuleItem[];
}

export const getCourseModules = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);

	if (!apiKey || !instanceUrl) {
		error(500, 'Canvas is not configured');
	}
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) {
		error(400, 'Invalid course ID');
	}

	const headers = { Authorization: `Bearer ${apiKey}` };
	const modules: CanvasModule[] = [];
	let page = 1;
	while (true) {
		const url: URL = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/modules`);
		url.searchParams.set('per_page', '100');
		url.searchParams.set('page', String(page));
		url.searchParams.append('include[]', 'items');
		url.searchParams.append('include[]', 'content_details');

		const res: Response = await fetch(url, { headers });
		if (!res.ok) {
			error(res.status, 'Unable to load course modules');
		}
		const batch: CanvasModule[] = await res.json();
		if (!Array.isArray(batch)) break;
		modules.push(...batch);
		const link = res.headers.get('Link') ?? res.headers.get('link');
		const hasNext = link ? link.includes('rel="next"') : false;
		if (hasNext) {
			page += 1;
			continue;
		}
		if (batch.length < 100) break;
		if (batch.length === 0) break;
		page += 1;
		if (page > 50) break;
	}

	return modules
		.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
		.map((m) => ({
			id: m.id,
			name: m.name ?? 'Untitled module',
			position: m.position ?? 0,
			state: m.state ?? 'active',
			unlockAt: m.unlock_at ?? null,
			requireSequentialProgress: m.require_sequential_progress ?? false,
			prerequisiteModuleIds: m.prerequisite_module_ids ?? [],
			itemsCount: m.items_count ?? m.items?.length ?? 0,
			items: (m.items ?? [])
				.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
				.map((it) => ({
					id: it.id,
					title: it.title ?? 'Untitled',
					type: it.type ?? 'Unknown',
					contentId: it.content_id ?? null,
					pageUrl: it.page_url ?? null,
					htmlUrl: it.html_url ?? it.url ?? null,
					position: it.position ?? 0,
					indent: it.indent ?? 0,
					published: it.published ?? true,
					completionRequirement: it.completion_requirement ?? null,
					pointsPossible: it.content_details?.points_possible ?? null,
					dueAt: it.content_details?.due_at ?? null,
					lockedForUser: it.content_details?.locked_for_user ?? null,
					unlockAt: it.content_details?.unlock_at ?? null
				}))
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
		const url: URL = new URL(`${instanceUrl}/api/v1/conversations`);
		url.searchParams.set('per_page', perPage);
		url.searchParams.set('page', String(page));
		url.searchParams.append('include[]', 'participant_avatars');
		url.searchParams.set('scope', 'inbox');

		const res: Response = await fetch(url, { headers });
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
		const properties = conv.properties ?? [];
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
			properties,
			hasAttachment: properties.includes('attachments'),
			audience: conv.audience ?? []
		};
	});
});

export const replyToConversation = command(
	'unchecked',
	async (input: { conversationId: string; body: string }) => {
		const apiKey = env.CANVAS_API_KEY;
		const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
		if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
		const parsedId = Number(input.conversationId);
		if (!Number.isSafeInteger(parsedId) || parsedId <= 0) error(400, 'Invalid conversation ID');
		const trimmed = input.body?.trim();
		if (!trimmed) error(400, 'Message body is required');
		if (trimmed.length > 20000) error(400, 'Message is too long');
		const url = `${instanceUrl}/api/v1/conversations/${parsedId}/add_message`;
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({ body: trimmed })
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			error(res.status, text || 'Unable to send reply');
		}
		try {
			return (await res.json()) as unknown;
		} catch {
			return { ok: true };
		}
	}
);

export const updateConversation = command(
	'unchecked',
	async (input: {
		conversationId: string;
		starred?: boolean;
		workflowState?: 'read' | 'unread' | 'archived';
	}) => {
		const apiKey = env.CANVAS_API_KEY;
		const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
		if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
		const parsedId = Number(input.conversationId);
		if (!Number.isSafeInteger(parsedId) || parsedId <= 0) error(400, 'Invalid conversation ID');
		const params = new URLSearchParams();
		if (typeof input.starred === 'boolean')
			params.set('conversation[starred]', String(input.starred));
		if (input.workflowState) params.set('conversation[workflow_state]', input.workflowState);
		if ([...params].length === 0) error(400, 'No updates provided');
		const res = await fetch(`${instanceUrl}/api/v1/conversations/${parsedId}`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			},
			body: params.toString()
		});
		if (!res.ok) error(res.status, 'Unable to update conversation');
		try {
			return (await res.json()) as unknown;
		} catch {
			return { ok: true };
		}
	}
);

export const bulkUpdateConversations = command(
	'unchecked',
	async (input: { conversationIds: string[]; workflowState: 'read' | 'unread' | 'archived' }) => {
		const apiKey = env.CANVAS_API_KEY;
		const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
		if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
		if (!Array.isArray(input.conversationIds) || input.conversationIds.length === 0)
			error(400, 'No conversation IDs provided');
		if (input.conversationIds.length > 200) error(400, 'Too many conversations');
		const headers = {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		};
		let last: unknown = null;
		for (const rawId of input.conversationIds) {
			const parsedId = Number(rawId);
			if (!Number.isSafeInteger(parsedId) || parsedId <= 0) continue;
			const params = new URLSearchParams();
			params.set('conversation[workflow_state]', input.workflowState);
			const res: Response = await fetch(`${instanceUrl}/api/v1/conversations/${parsedId}`, {
				method: 'PUT',
				headers,
				body: params.toString()
			});
			if (!res.ok) error(res.status, 'Unable to update conversations');
			try {
				last = await res.json();
			} catch {
				last = { ok: true };
			}
		}
		return last;
	}
);

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

interface CanvasCalendarEvent {
	id: number | string;
	title?: string | null;
	description?: string | null;
	start_at?: string | null;
	end_at?: string | null;
	all_day?: boolean;
	all_day_date?: string | null;
	context_code?: string | null;
	context_name?: string | null;
	workflow_state?: string;
	hidden?: boolean;
	url?: string | null;
	html_url?: string | null;
	type?: string;
	assignment?: {
		id?: number;
		name?: string | null;
		due_at?: string | null;
		html_url?: string | null;
		description?: string | null;
		points_possible?: number | null;
	} | null;
	important_dates?: boolean;
}

interface CanvasPlannerItem {
	plannable_id: number | string;
	plannable_type: string;
	plannable_date?: string | null;
	html_url?: string | null;
	context_name?: string | null;
	context_type?: string | null;
	course_id?: number | null;
	plannable?: {
		title?: string | null;
		due_at?: string | null;
		todo_date?: string | null;
		start_at?: string | null;
		end_at?: string | null;
		details?: string | null;
		description?: string | null;
		points_possible?: number | null;
	};
	new_activity?: boolean;
	planner_override?: unknown;
	submissions?: unknown;
}

export const getCalendarEvents = query(
	'unchecked',
	async (opts: { start: string; end: string }) => {
		const apiKey = env.CANVAS_API_KEY;
		const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/\/$/, '');

		if (!apiKey || !instanceUrl) {
			error(500, 'Canvas is not configured');
		}

		const headers = { Authorization: `Bearer ${apiKey}` };

		const colorsPromise: Promise<CanvasColors> = fetch(`${instanceUrl}/api/v1/users/self/colors`, {
			headers
		})
			.then(async (r) => {
				if (!r.ok) return {} as CanvasColors;
				try {
					return (await r.json()) as CanvasColors;
				} catch {
					return {} as CanvasColors;
				}
			})
			.catch(() => ({}) as CanvasColors);

		// Fetch calendar_events and planner items in parallel, collecting paginated results
		async function fetchPaged<T>(baseUrl: URL): Promise<T[]> {
			const all: T[] = [];
			let page = 1;
			while (true) {
				const url = new URL(baseUrl.toString());
				url.searchParams.set('per_page', '100');
				url.searchParams.set('page', String(page));
				const res = await fetch(url, { headers });
				if (!res.ok) {
					// For calendar, 401/403 should surface; for other ranges just break with what we have
					if (all.length === 0) error(res.status, 'Unable to load calendar events');
					break;
				}
				const batch: T[] = await res.json();
				// Canvas sometimes returns object with error outside array — bail
				if (!Array.isArray(batch)) break;
				all.push(...batch);
				const link = res.headers.get('Link') ?? res.headers.get('link');
				const hasNext = link ? link.includes('rel="next"') : false;
				if (hasNext) {
					page += 1;
					continue;
				}
				if (batch.length < 100) break;
				if (batch.length === 0) break;
				page += 1;
				if (page > 20) break;
			}
			return all;
		}

		const calUrl = new URL(`${instanceUrl}/api/v1/calendar_events`);
		calUrl.searchParams.set('all_events', 'true');
		calUrl.searchParams.set('start_date', opts.start);
		calUrl.searchParams.set('end_date', opts.end);
		calUrl.searchParams.set('per_page', '100');
		// include assignment details and context
		calUrl.searchParams.append('type', 'assignment');
		calUrl.searchParams.append('type', 'calendar_event');
		calUrl.searchParams.append('type', 'appointment_group');

		const plannerUrl = new URL(`${instanceUrl}/api/v1/planner/items`);
		plannerUrl.searchParams.set('start_date', opts.start);
		plannerUrl.searchParams.set('end_date', opts.end);
		plannerUrl.searchParams.set('per_page', '100');
		plannerUrl.searchParams.set('order', 'asc');

		const [calendarEvents, plannerItems, colors] = await Promise.all([
			fetchPaged<CanvasCalendarEvent>(calUrl).catch(() => [] as CanvasCalendarEvent[]),
			fetchPaged<CanvasPlannerItem>(plannerUrl).catch(() => [] as CanvasPlannerItem[]),
			colorsPromise
		]);

		const seen = new Set<string>();
		// Normalize calendar events
		const fromCalendar = calendarEvents
			.filter((e) => !e.hidden)
			.map((e) => {
				const contextCode = e.context_code ?? null;
				const courseMatch = contextCode?.match(/^course_(\d+)/);
				const courseId = courseMatch ? courseMatch[1] : null;
				const isAssignment = e.type === 'assignment' || !!e.assignment;
				// assignment due_at takes precedence, otherwise start_at / all_day_date
				const assignmentDue = e.assignment?.due_at ?? null;
				const start =
					assignmentDue ??
					e.start_at ??
					(e.all_day_date ? `${e.all_day_date}T00:00:00.000Z` : null);
				const end = e.end_at ?? null;
				const color = contextCode ? (colors.custom_colors?.[contextCode] ?? null) : null;
				const id = `cal-${e.id}`;
				seen.add(`${e.title ?? ''}|${start ?? ''}|${contextCode ?? ''}`);
				return {
					id,
					rawId: String(e.id),
					title: (e.assignment?.name ?? e.title ?? 'Untitled').trim() || 'Untitled',
					description: e.description ?? e.assignment?.description ?? null,
					start,
					end,
					allDay: Boolean(e.all_day) || !!e.all_day_date,
					allDayDate: e.all_day_date ?? null,
					type: (isAssignment ? 'assignment' : (e.type ?? 'calendar_event')) as string,
					contextCode,
					contextName: e.context_name ?? null,
					courseId,
					color,
					url: e.url ?? null,
					htmlUrl: e.html_url ?? e.assignment?.html_url ?? null,
					pointsPossible: e.assignment?.points_possible ?? null,
					source: 'calendar' as const
				};
			});

		const fromPlanner = plannerItems
			.map((p) => {
				const plannable = p.plannable ?? {};
				const title = (plannable.title ?? String(p.plannable_id)).trim() || 'Untitled';
				const start =
					p.plannable_date ?? plannable.due_at ?? plannable.todo_date ?? plannable.start_at ?? null;
				const end = plannable.end_at ?? null;
				const contextCode =
					p.course_id != null
						? `course_${p.course_id}`
						: p.context_type && p.context_type.toLowerCase() === 'course' && p.course_id
							? `course_${p.course_id}`
							: null;
				const key = `${title}|${start ?? ''}|${contextCode ?? ''}`;
				if (seen.has(key)) return null;
				seen.add(key);
				const courseId = contextCode ? contextCode.replace('course_', '') : null;
				const color = contextCode ? (colors.custom_colors?.[contextCode] ?? null) : null;
				return {
					id: `planner-${p.plannable_type}-${p.plannable_id}`,
					rawId: String(p.plannable_id),
					title,
					description: plannable.details ?? plannable.description ?? null,
					start,
					end,
					allDay: false,
					allDayDate: null,
					type: p.plannable_type as string,
					contextCode,
					contextName: p.context_name ?? null,
					courseId,
					color,
					url: null,
					htmlUrl: p.html_url ?? null,
					pointsPossible:
						(plannable as { points_possible?: number | null }).points_possible ?? null,
					source: 'planner' as const
				};
			})
			.filter((x): x is NonNullable<typeof x> => x !== null && x.start !== null);

		return [...fromCalendar, ...fromPlanner].filter((e) => e.start);
	}
);

interface CanvasAnnouncementTopic {
	id: number;
	title?: string | null;
	message?: string | null;
	posted_at?: string | null;
	last_reply_at?: string | null;
	created_at?: string | null;
	author?: {
		display_name?: string | null;
		avatar_image_url?: string | null;
		id?: number | null;
	} | null;
	reply_count?: number;
	html_url?: string | null;
	url?: string | null;
	read_state?: string | null;
	is_announcement?: boolean;
}

interface CanvasAssignment {
	id: number;
	name?: string | null;
	description?: string | null;
	due_at?: string | null;
	points_possible?: number | null;
	html_url?: string | null;
	submission_types?: string[] | null;
	workflow_state?: string | null;
	published?: boolean | null;
	lock_at?: string | null;
	unlock_at?: string | null;
	grading_type?: string | null;
}

interface CanvasSubmission {
	id: number;
	score?: number | null;
	grade?: string | null;
	graded_at?: string | null;
	submitted_at?: string | null;
	workflow_state?: string | null;
	excused?: boolean | null;
	assignment?: CanvasAssignment | null;
}

interface CanvasDiscussion {
	id: number;
	title?: string | null;
	message?: string | null;
	posted_at?: string | null;
	last_reply_at?: string | null;
	created_at?: string | null;
	author?: { display_name?: string | null; avatar_image_url?: string | null } | null;
	discussion_type?: string | null;
	reply_count?: number | null;
	discussion_subentry_count?: number | null;
	html_url?: string | null;
	published?: boolean | null;
	locked?: boolean | null;
	is_announcement?: boolean | null;
}

interface CanvasCourseUser {
	id: number;
	name?: string | null;
	short_name?: string | null;
	sortable_name?: string | null;
	avatar_url?: string | null;
	enrollments?:
		{ type?: string | null; role?: string | null; enrollment_state?: string | null }[] | null;
	pronouns?: string | null;
	login_id?: string | null;
	email?: string | null;
}

interface CanvasWikiPageListItem {
	url: string;
	title?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	front_page?: boolean | null;
	html_url?: string | null;
	page_id?: number | null;
	published?: boolean | null;
}

interface CanvasCollaboration {
	id: number;
	title?: string | null;
	collaboration_type?: string | null;
	url?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	user_id?: number | null;
}

interface CanvasCourseDetails {
	id: number;
	name?: string | null;
	syllabus_body?: string | null;
	html_url?: string | null;
	course_code?: string | null;
}

export const getCourseAnnouncements = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) error(400, 'Invalid course ID');
	const headers = { Authorization: `Bearer ${apiKey}` };
	const data: CanvasAnnouncementTopic[] = [];
	let page = 1;
	while (true) {
		const url: URL = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/discussion_topics`);
		url.searchParams.set('only_announcements', 'true');
		url.searchParams.set('per_page', '100');
		url.searchParams.set('page', String(page));
		const res: Response = await fetch(url, { headers });
		if (!res.ok) error(res.status, 'Unable to load announcements');
		const batch: CanvasAnnouncementTopic[] = await res.json();
		if (!Array.isArray(batch)) break;
		data.push(...batch);
		if (!(res.headers.get('Link') ?? '').includes('rel="next"') && batch.length < 100) break;
		if (batch.length === 0 || page >= 20) break;
		page += 1;
	}
	return data.map((a) => ({
		id: a.id,
		title: a.title ?? '(No subject)',
		message: a.message ?? '',
		postedAt: a.posted_at ?? a.created_at ?? null,
		lastReplyAt: a.last_reply_at ?? null,
		authorName: a.author?.display_name ?? 'Unknown',
		authorAvatar: a.author?.avatar_image_url ?? null,
		htmlUrl: a.html_url ?? a.url ?? null,
		replyCount: a.reply_count ?? 0
	}));
});

export const getCourseGrades = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) error(400, 'Invalid course ID');

	const submissions: CanvasSubmission[] = [];
	let page = 1;
	while (true) {
		const url: URL = new URL(
			`${instanceUrl}/api/v1/courses/${parsedCourseId}/students/submissions`
		);
		url.searchParams.append('student_ids[]', 'self');
		url.searchParams.append('include[]', 'assignment');
		url.searchParams.set('per_page', '100');
		url.searchParams.set('page', String(page));
		const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
		if (!res.ok) error(res.status, 'Unable to load grades');
		const batch: CanvasSubmission[] = await res.json();
		if (!Array.isArray(batch)) break;
		submissions.push(...batch);
		if (!(res.headers.get('Link') ?? '').includes('rel="next"') && batch.length < 100) break;
		if (batch.length === 0 || page >= 20) break;
		page += 1;
	}

	return submissions
		.filter((submission) => submission.assignment)
		.map((submission) => ({
			id: submission.id,
			assignmentId: submission.assignment!.id,
			name: submission.assignment!.name ?? 'Untitled assignment',
			dueAt: submission.assignment!.due_at ?? null,
			pointsPossible: submission.assignment!.points_possible ?? null,
			score: submission.score ?? null,
			grade: submission.grade ?? null,
			gradedAt: submission.graded_at ?? null,
			submittedAt: submission.submitted_at ?? null,
			workflowState: submission.workflow_state ?? null,
			excused: submission.excused ?? false
		}));
});

export const getCourseAssignments = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) error(400, 'Invalid course ID');
	const headers = { Authorization: `Bearer ${apiKey}` };
	const assignments: CanvasAssignment[] = [];
	let page = 1;
	while (true) {
		const url: URL = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/assignments`);
		url.searchParams.set('per_page', '100');
		url.searchParams.set('page', String(page));
		url.searchParams.set('order_by', 'due_at');
		const res: Response = await fetch(url, { headers });
		if (!res.ok) error(res.status, 'Unable to load assignments');
		const batch: CanvasAssignment[] = await res.json();
		if (!Array.isArray(batch)) break;
		assignments.push(...batch);
		const link = res.headers.get('Link') ?? res.headers.get('link');
		const hasNext = link ? link.includes('rel="next"') : false;
		if (hasNext) {
			page += 1;
			continue;
		}
		if (batch.length < 100) break;
		if (batch.length === 0) break;
		page += 1;
		if (page > 20) break;
	}
	return assignments.map((a) => ({
		id: a.id,
		name: a.name ?? 'Untitled',
		description: a.description ?? '',
		dueAt: a.due_at ?? null,
		pointsPossible: a.points_possible ?? null,
		htmlUrl: a.html_url ?? null,
		submissionTypes: a.submission_types ?? [],
		workflowState: a.workflow_state ?? 'published',
		published: a.published ?? true,
		lockAt: a.lock_at ?? null,
		unlockAt: a.unlock_at ?? null
	}));
});

export const getCourseDiscussions = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) error(400, 'Invalid course ID');
	const headers = { Authorization: `Bearer ${apiKey}` };
	const data: CanvasDiscussion[] = [];
	let page = 1;
	while (true) {
		const url: URL = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/discussion_topics`);
		url.searchParams.set('per_page', '100');
		url.searchParams.set('page', String(page));
		const res: Response = await fetch(url, { headers });
		if (!res.ok) error(res.status, 'Unable to load discussions');
		const batch: CanvasDiscussion[] = await res.json();
		if (!Array.isArray(batch)) break;
		data.push(...batch);
		if (!(res.headers.get('Link') ?? '').includes('rel="next"') && batch.length < 100) break;
		if (batch.length === 0 || page >= 20) break;
		page += 1;
	}
	return data
		.filter((d) => !d.is_announcement as unknown as boolean)
		.map((d) => ({
			id: d.id,
			title: d.title ?? '(No title)',
			message: d.message ?? '',
			postedAt: d.posted_at ?? d.created_at ?? null,
			lastReplyAt: d.last_reply_at ?? null,
			authorName: d.author?.display_name ?? 'Unknown',
			type: d.discussion_type ?? 'side_comment',
			replyCount: d.reply_count ?? d.discussion_subentry_count ?? 0,
			htmlUrl: d.html_url ?? null,
			published: d.published ?? true,
			locked: d.locked ?? false
		}));
});

export const getCoursePeople = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) error(400, 'Invalid course ID');
	const headers = { Authorization: `Bearer ${apiKey}` };
	const people: CanvasCourseUser[] = [];
	let page = 1;
	while (true) {
		const url: URL = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/users`);
		url.searchParams.set('per_page', '100');
		url.searchParams.set('page', String(page));
		url.searchParams.append('include[]', 'enrollments');
		url.searchParams.append('include[]', 'avatar_url');
		const res: Response = await fetch(url, { headers });
		if (!res.ok) error(res.status, 'Unable to load people');
		const batch: CanvasCourseUser[] = await res.json();
		if (!Array.isArray(batch)) break;
		people.push(...batch);
		const link = res.headers.get('Link') ?? res.headers.get('link');
		const hasNext = link ? link.includes('rel="next"') : false;
		if (hasNext) {
			page += 1;
			continue;
		}
		if (batch.length < 100) break;
		if (batch.length === 0) break;
		page += 1;
		if (page > 20) break;
	}
	return people.map((p) => ({
		id: p.id,
		name: p.name ?? p.short_name ?? 'Unknown',
		shortName: p.short_name ?? null,
		avatarUrl: p.avatar_url ?? null,
		pronouns: p.pronouns ?? null,
		loginId: p.login_id ?? null,
		email: p.email ?? null,
		role: p.enrollments?.[0]?.role ?? p.enrollments?.[0]?.type ?? 'Student',
		enrollmentState: p.enrollments?.[0]?.enrollment_state ?? null
	}));
});

export const getCoursePages = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) error(400, 'Invalid course ID');
	const headers = { Authorization: `Bearer ${apiKey}` };
	const pages: CanvasWikiPageListItem[] = [];
	let page = 1;
	while (true) {
		const url: URL = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/pages`);
		url.searchParams.set('per_page', '100');
		url.searchParams.set('page', String(page));
		url.searchParams.set('sort', 'title');
		const res: Response = await fetch(url, { headers });
		if (!res.ok) {
			if (res.status === 404) return [];
			error(res.status, 'Unable to load pages');
		}
		const batch: CanvasWikiPageListItem[] = await res.json();
		if (!Array.isArray(batch)) break;
		pages.push(...batch);
		const link = res.headers.get('Link') ?? res.headers.get('link');
		const hasNext = link ? link.includes('rel="next"') : false;
		if (hasNext) {
			page += 1;
			continue;
		}
		if (batch.length < 100) break;
		if (batch.length === 0) break;
		page += 1;
		if (page > 10) break;
	}
	return pages.map((p) => ({
		url: p.url,
		title: p.title ?? p.url,
		createdAt: p.created_at ?? null,
		updatedAt: p.updated_at ?? null,
		frontPage: p.front_page ?? false,
		htmlUrl: p.html_url ?? `${instanceUrl}/courses/${parsedCourseId}/pages/${p.url}`,
		published: p.published ?? true
	}));
});

export const getCoursePage = query(
	'unchecked',
	async (args: { courseId: string; pageUrl: string }) => {
		const apiKey = env.CANVAS_API_KEY;
		const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
		const parsedCourseId = Number(args.courseId);
		if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
		if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0)
			error(400, 'Invalid course ID');
		if (!args.pageUrl.trim()) error(400, 'Invalid page URL');

		const response = await fetch(
			`${instanceUrl}/api/v1/courses/${parsedCourseId}/pages/${encodeURIComponent(args.pageUrl)}`,
			{ headers: { Authorization: `Bearer ${apiKey}` } }
		);
		if (!response.ok) error(response.status, 'Unable to load page');
		const page: CanvasWikiPageListItem & CanvasPage = await response.json();
		return {
			url: page.url,
			title: page.title ?? page.url,
			body: page.body ?? '',
			createdAt: page.created_at ?? null,
			updatedAt: page.updated_at ?? null,
			frontPage: page.front_page ?? false,
			published: page.published ?? true
		};
	}
);

export const getCoursePageBodies = query(
	'unchecked',
	async (args: { courseId: string; pageUrls: string[] }) => {
		const apiKey = env.CANVAS_API_KEY;
		const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
		const parsedCourseId = Number(args.courseId);
		if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
		if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0)
			error(400, 'Invalid course ID');
		if (args.pageUrls.length > 1000) error(400, 'Too many page URLs');

		const headers = { Authorization: `Bearer ${apiKey}` };
		const bodies: Record<string, string> = {};
		let failed = 0;
		for (let index = 0; index < args.pageUrls.length; index += 10) {
			const batch = args.pageUrls.slice(index, index + 10);
			const results = await Promise.allSettled(
				batch.map(async (pageUrl) => {
					const response = await fetch(
						`${instanceUrl}/api/v1/courses/${parsedCourseId}/pages/${encodeURIComponent(pageUrl)}`,
						{ headers }
					);
					if (!response.ok) throw new Error(`Unable to load page ${pageUrl}`);
					const page: CanvasPage = await response.json();
					return { pageUrl, body: page.body ?? '' };
				})
			);
			for (const result of results) {
				if (result.status === 'fulfilled') bodies[result.value.pageUrl] = result.value.body;
				else failed += 1;
			}
		}
		return { bodies, failed };
	}
);

export const getCourseAssignment = query(
	'unchecked',
	async (args: { courseId: string; assignmentId: string }) => {
		const { courseId, assignmentId } = args;
		const apiKey = env.CANVAS_API_KEY;
		const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
		const parsedCourseId = Number(courseId);
		const parsedAssignmentId = Number(assignmentId);
		if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
		if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0)
			error(400, 'Invalid course ID');
		if (!Number.isSafeInteger(parsedAssignmentId) || parsedAssignmentId <= 0)
			error(400, 'Invalid assignment ID');
		const res = await fetch(
			`${instanceUrl}/api/v1/courses/${parsedCourseId}/assignments/${parsedAssignmentId}`,
			{ headers: { Authorization: `Bearer ${apiKey}` } }
		);
		if (!res.ok) error(res.status, 'Unable to load assignment');
		const a: CanvasAssignment & {
			course_id?: number;
			allowed_attempts?: number | null;
			group_category_id?: number | null;
			omit_from_final_grade?: boolean | null;
			moderated_grading?: boolean | null;
			has_submitted_submissions?: boolean | null;
		} = await res.json();
		return {
			id: a.id,
			name: a.name ?? 'Untitled',
			description: a.description ?? '',
			dueAt: a.due_at ?? null,
			pointsPossible: a.points_possible ?? null,
			htmlUrl: a.html_url ?? null,
			submissionTypes: a.submission_types ?? [],
			workflowState: a.workflow_state ?? 'published',
			published: a.published ?? true,
			lockAt: a.lock_at ?? null,
			unlockAt: a.unlock_at ?? null,
			gradingType: a.grading_type ?? null,
			allowedAttempts: a.allowed_attempts ?? null,
			courseId: a.course_id ?? parsedCourseId
		};
	}
);

export const getCourseCollaborations = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) error(400, 'Invalid course ID');
	const headers = { Authorization: `Bearer ${apiKey}` };
	const data: CanvasCollaboration[] = [];
	let page = 1;
	while (true) {
		const url: URL = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/collaborations`);
		url.searchParams.set('per_page', '100');
		url.searchParams.set('page', String(page));
		const res: Response = await fetch(url, { headers });
		if (!res.ok) {
			if (res.status === 404 || res.status === 403) return [];
			error(res.status, 'Unable to load collaborations');
		}
		const batch: CanvasCollaboration[] = await res.json();
		if (!Array.isArray(batch)) break;
		data.push(...batch);
		if (!(res.headers.get('Link') ?? '').includes('rel="next"') && batch.length < 100) break;
		if (batch.length === 0 || page >= 20) break;
		page += 1;
	}
	return data.map((c) => ({
		id: c.id,
		title: c.title ?? 'Untitled',
		type: c.collaboration_type ?? 'unknown',
		url: c.url ?? null,
		createdAt: c.created_at ?? null,
		updatedAt: c.updated_at ?? null
	}));
});

export const getCourseDetails = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) error(400, 'Invalid course ID');
	const res = await fetch(`${instanceUrl}/api/v1/courses/${parsedCourseId}`, {
		headers: { Authorization: `Bearer ${apiKey}` }
	});
	if (!res.ok) error(res.status, 'Unable to load course details');
	const course: CanvasCourseDetails = await res.json();
	return {
		id: course.id,
		name: course.name ?? 'Course',
		courseCode: course.course_code ?? null,
		syllabusBody: course.syllabus_body ?? '',
		htmlUrl: course.html_url ?? `${instanceUrl}/courses/${parsedCourseId}/assignments/syllabus`
	};
});

export const getCourseChatLaunch = query('unchecked', async (courseId: string) => {
	const apiKey = env.CANVAS_API_KEY;
	const instanceUrl = env.CANVAS_INSTANCE_URL?.replace(/\/$/, '');
	const parsedCourseId = Number(courseId);
	if (!apiKey || !instanceUrl) error(500, 'Canvas is not configured');
	if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) error(400, 'Invalid course ID');
	const res = await fetch(
		`${instanceUrl}/api/v1/courses/${parsedCourseId}/external_tools/sessionless_launch?id=2&launch_type=course_navigation`,
		{ headers: { Authorization: `Bearer ${apiKey}` } }
	);
	if (!res.ok) {
		if (res.status === 404) return { url: null, name: 'Chat' };
		error(res.status, 'Unable to load Chat');
	}
	const data: { url?: string; name?: string } = await res.json();
	return {
		url: data.url ?? null,
		name: data.name ?? 'Chat Room'
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
