import { command, query } from '$app/server';
import { error } from '@sveltejs/kit';
import {
	canvasHeaders,
	fetchColors,
	fetchPaginated,
	hasNextPage,
	parseCourseId,
	parseId,
	requireCanvasEnv
} from './canvas/helpers.server';
import type {
	CanvasAnnouncementTopic,
	CanvasAssignment,
	CanvasCalendarEvent,
	CanvasCollaboration,
	CanvasColors,
	CanvasConversation,
	CanvasCourse,
	CanvasCourseDetails,
	CanvasCourseUser,
	CanvasDiscussion,
	CanvasModule,
	CanvasPage,
	CanvasPlannerItem,
	CanvasProfile,
	CanvasSingleConversation,
	CanvasSubmission,
	CanvasTab,
	CanvasWikiPageListItem
} from './canvas/types';

export const getCourses = query(async () => {
	const { apiKey, instanceUrl } = requireCanvasEnv();

	const courseUrl = (enrollmentState: 'active' | 'completed') => {
		const url = new URL(`${instanceUrl}/api/v1/courses`);
		url.searchParams.set('enrollment_state', enrollmentState);
		url.searchParams.set('per_page', '100');
		url.searchParams.append('include[]', 'term');
		url.searchParams.append('include[]', 'course_image');
		url.searchParams.append('include[]', 'favorites');
		return url;
	};

	const headers = canvasHeaders(apiKey);
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
	const { apiKey, instanceUrl } = requireCanvasEnv();

	const url = new URL(`${instanceUrl}/api/v1/users/self/favorites/courses`);
	url.searchParams.append('include[]', 'course_image');

	const headers = canvasHeaders(apiKey);
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);

	const response = await fetch(`${instanceUrl}/api/v1/courses/${parsedCourseId}/tabs`, {
		headers: canvasHeaders(apiKey)
	});

	if (!response.ok) {
		error(response.status, 'Unable to load course tabs');
	}

	const tabs: CanvasTab[] = await response.json();
	return tabs
		.filter((tab) => {
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

export const getCourseModules = query('unchecked', async (courseId: string) => {
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);

	const headers = canvasHeaders(apiKey);
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
		if (hasNextPage(link)) {
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);

	const response = await fetch(`${instanceUrl}/api/v1/courses/${parsedCourseId}/front_page`, {
		headers: canvasHeaders(apiKey)
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const headers = canvasHeaders(apiKey);

	const colorsPromise = fetchColors(instanceUrl, headers);

	const baseUrl = new URL(`${instanceUrl}/api/v1/conversations`);
	baseUrl.searchParams.append('include[]', 'participant_avatars');
	baseUrl.searchParams.set('scope', 'inbox');
	const allConversations = await fetchPaginated<CanvasConversation>(baseUrl, headers, {
		maxPages: 20
	});

	const colors = await colorsPromise;

	return allConversations.map((conv) => {
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
		const { apiKey, instanceUrl } = requireCanvasEnv();
		const parsedId = parseId(input.conversationId, 'Invalid conversation ID');
		const trimmed = input.body?.trim();
		if (!trimmed) error(400, 'Message body is required');
		if (trimmed.length > 20000) error(400, 'Message is too long');
		const url = `${instanceUrl}/api/v1/conversations/${parsedId}/add_message`;
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				...canvasHeaders(apiKey),
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
		const { apiKey, instanceUrl } = requireCanvasEnv();
		const parsedId = parseId(input.conversationId, 'Invalid conversation ID');
		const params = new URLSearchParams();
		if (typeof input.starred === 'boolean')
			params.set('conversation[starred]', String(input.starred));
		if (input.workflowState) params.set('conversation[workflow_state]', input.workflowState);
		if ([...params].length === 0) error(400, 'No updates provided');
		const res = await fetch(`${instanceUrl}/api/v1/conversations/${parsedId}`, {
			method: 'PUT',
			headers: {
				...canvasHeaders(apiKey),
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
		const { apiKey, instanceUrl } = requireCanvasEnv();
		if (!Array.isArray(input.conversationIds) || input.conversationIds.length === 0)
			error(400, 'No conversation IDs provided');
		if (input.conversationIds.length > 200) error(400, 'Too many conversations');
		const headers = {
			...canvasHeaders(apiKey),
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedId = parseId(conversationId, 'Invalid conversation ID');

	const url = new URL(`${instanceUrl}/api/v1/conversations/${parsedId}`);
	url.searchParams.append('include[]', 'participant_avatars');
	url.searchParams.set('auto_mark_as_read', 'false');

	const response = await fetch(url, { headers: canvasHeaders(apiKey) });

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

export const getCalendarEvents = query(
	'unchecked',
	async (opts: { start: string; end: string }) => {
		const { apiKey, instanceUrl } = requireCanvasEnv();
		const headers = canvasHeaders(apiKey);

		const colorsPromise = fetchColors(instanceUrl, headers);

		async function fetchPaged<T>(baseUrl: URL): Promise<T[]> {
			return fetchPaginated<T>(baseUrl, headers, { maxPages: 20 });
		}

		const calUrl = new URL(`${instanceUrl}/api/v1/calendar_events`);
		calUrl.searchParams.set('all_events', 'true');
		calUrl.searchParams.set('start_date', opts.start);
		calUrl.searchParams.set('end_date', opts.end);
		calUrl.searchParams.set('per_page', '100');
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
		const fromCalendar = calendarEvents
			.filter((e) => !e.hidden)
			.map((e) => {
				const contextCode = e.context_code ?? null;
				const courseMatch = contextCode?.match(/^course_(\d+)/);
				const courseId = courseMatch ? courseMatch[1] : null;
				const isAssignment = e.type === 'assignment' || !!e.assignment;
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

export const getCourseAnnouncements = query('unchecked', async (courseId: string) => {
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);
	const headers = canvasHeaders(apiKey);
	const baseUrl = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/discussion_topics`);
	baseUrl.searchParams.set('only_announcements', 'true');
	const data = await fetchPaginated<CanvasAnnouncementTopic>(baseUrl, headers);
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);

	const baseUrl = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/students/submissions`);
	baseUrl.searchParams.append('student_ids[]', 'self');
	baseUrl.searchParams.append('include[]', 'assignment');
	const submissions = await fetchPaginated<CanvasSubmission>(baseUrl, canvasHeaders(apiKey));

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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);
	const baseUrl = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/assignments`);
	baseUrl.searchParams.set('order_by', 'due_at');
	const assignments = await fetchPaginated<CanvasAssignment>(baseUrl, canvasHeaders(apiKey));
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);
	const baseUrl = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/discussion_topics`);
	const data = await fetchPaginated<CanvasDiscussion>(baseUrl, canvasHeaders(apiKey));
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);
	const baseUrl = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/users`);
	baseUrl.searchParams.append('include[]', 'enrollments');
	baseUrl.searchParams.append('include[]', 'avatar_url');
	const people = await fetchPaginated<CanvasCourseUser>(baseUrl, canvasHeaders(apiKey));
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);
	const headers = canvasHeaders(apiKey);
	const baseUrl = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/pages`);
	baseUrl.searchParams.set('sort', 'title');
	// Custom handling for 404 → empty list
	const pages: CanvasWikiPageListItem[] = [];
	let page = 1;
	while (true) {
		const url = new URL(baseUrl.toString());
		url.searchParams.set('per_page', '100');
		url.searchParams.set('page', String(page));
		const res = await fetch(url, { headers });
		if (!res.ok) {
			if (res.status === 404) return [];
			error(res.status, 'Unable to load pages');
		}
		const batch: CanvasWikiPageListItem[] = await res.json();
		if (!Array.isArray(batch)) break;
		pages.push(...batch);
		const link = res.headers.get('Link') ?? res.headers.get('link');
		if (hasNextPage(link)) {
			page += 1;
			continue;
		}
		if (batch.length < 100) break;
		if (batch.length === 0) break;
		page += 1;
		if (page > 10) break;
	}
	return pages.map((p) => ({
		id: p.page_id ?? null,
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
	async (args: { courseId: string; pageId: string }) => {
		const { apiKey, instanceUrl } = requireCanvasEnv();
		const parsedCourseId = parseCourseId(args.courseId);
		if (!args.pageId.trim()) error(400, 'Invalid page ID');

		const response = await fetch(
			`${instanceUrl}/api/v1/courses/${parsedCourseId}/pages/${encodeURIComponent(args.pageId)}`,
			{ headers: canvasHeaders(apiKey) }
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
		const { apiKey, instanceUrl } = requireCanvasEnv();
		const parsedCourseId = parseCourseId(args.courseId);
		if (args.pageUrls.length > 1000) error(400, 'Too many page URLs');

		const headers = canvasHeaders(apiKey);
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
		const { apiKey, instanceUrl } = requireCanvasEnv();
		const parsedCourseId = parseCourseId(courseId);
		const parsedAssignmentId = parseId(assignmentId, 'Invalid assignment ID');
		const res = await fetch(
			`${instanceUrl}/api/v1/courses/${parsedCourseId}/assignments/${parsedAssignmentId}`,
			{ headers: canvasHeaders(apiKey) }
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);
	const headers = canvasHeaders(apiKey);
	const baseUrl = new URL(`${instanceUrl}/api/v1/courses/${parsedCourseId}/collaborations`);
	const data = await fetchPaginated<CanvasCollaboration>(baseUrl, headers);
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);
	const res = await fetch(`${instanceUrl}/api/v1/courses/${parsedCourseId}`, {
		headers: canvasHeaders(apiKey)
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
	const { apiKey, instanceUrl } = requireCanvasEnv();
	const parsedCourseId = parseCourseId(courseId);
	const res = await fetch(
		`${instanceUrl}/api/v1/courses/${parsedCourseId}/external_tools/sessionless_launch?id=2&launch_type=course_navigation`,
		{ headers: canvasHeaders(apiKey) }
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
	const { apiKey, instanceUrl } = requireCanvasEnv();

	const response = await fetch(`${instanceUrl}/api/v1/users/self/profile`, {
		headers: canvasHeaders(apiKey)
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
