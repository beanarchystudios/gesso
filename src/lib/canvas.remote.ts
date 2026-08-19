import { env } from '$env/dynamic/private';
import { query } from '$app/server';
import { error } from '@sveltejs/kit';

interface CanvasProfile {
	name?: string;
	short_name?: string;
	avatar_url?: string;
}

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
