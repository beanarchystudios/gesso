<script lang="ts">
	import { page } from '$app/state';
	import { getFavoriteCourses } from '$lib/canvas.remote';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import AppSidebar from './app-sidebar.svelte';

	const { children } = $props();
	const courseId = $derived(page.params.courseId);
	const courses = $derived(courseId ? getFavoriteCourses() : null);
</script>

<Sidebar.Provider>
	<AppSidebar />
	{#if courses}
		{#await courses}
			<Sidebar.Inset class="max-h-[calc(100vh-1rem)] overflow-hidden">
				{@render children()}
			</Sidebar.Inset>
		{:then courses}
			<Sidebar.Inset
				style={`--course-color: ${courses.find((course) => course.id.toString() === courseId)?.color ?? 'var(--primary)'}`}
				class="max-h-[calc(100vh-1rem)] overflow-hidden ring-1 ring-(--course-color)/75"
			>
				{@render children()}
			</Sidebar.Inset>
		{/await}
	{:else}
		<Sidebar.Inset class="max-h-[calc(100vh-1rem)] overflow-hidden">
			{@render children()}
		</Sidebar.Inset>
	{/if}
</Sidebar.Provider>
