export interface CanvasProfile {
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

export interface CanvasCourse {
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

export interface CanvasColors {
	custom_colors?: Record<string, string>;
}

export interface CanvasPage {
	title?: string;
	body?: string;
}

export interface CanvasTab {
	id: string;
	label?: string;
	html_url?: string;
	position?: number;
	type?: string;
}

export interface CanvasConversationParticipant {
	id: number;
	name?: string;
	avatar_url?: string | null;
}

export interface CanvasConversation {
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

export interface CanvasConversationMessage {
	id: number;
	body?: string | null;
	created_at?: string | null;
	author_id?: number | null;
	generated?: boolean;
}

export interface CanvasSingleConversation extends CanvasConversation {
	messages?: CanvasConversationMessage[];
}

export interface CanvasModuleItem {
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

export interface CanvasModule {
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

export interface CanvasCalendarEvent {
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

export interface CanvasPlannerItem {
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

export interface CanvasAnnouncementTopic {
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

export interface CanvasAssignment {
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

export interface CanvasSubmission {
	id: number;
	score?: number | null;
	grade?: string | null;
	graded_at?: string | null;
	submitted_at?: string | null;
	workflow_state?: string | null;
	excused?: boolean | null;
	assignment?: CanvasAssignment | null;
}

export interface CanvasDiscussion {
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

export interface CanvasCourseUser {
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

export interface CanvasWikiPageListItem {
	url: string;
	title?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	front_page?: boolean | null;
	html_url?: string | null;
	page_id?: number | null;
	published?: boolean | null;
}

export interface CanvasCollaboration {
	id: number;
	title?: string | null;
	collaboration_type?: string | null;
	url?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	user_id?: number | null;
}

export interface CanvasCourseDetails {
	id: number;
	name?: string | null;
	syllabus_body?: string | null;
	html_url?: string | null;
	course_code?: string | null;
}
