<script lang="ts">
	import { resolve } from '$app/paths';
	import { getCourses } from '$lib/canvas';
	import * as Command from '$lib/components/ui/command';
	import { onMount } from 'svelte';

	let open = $state(false);
	let query = $state('');
	const courses = getCourses();

	function courseHref(courseId: number) {
		return resolve('/(app)/courses/[courseId]', { courseId: courseId.toString() });
	}

	onMount(() => {
		function handleKeydown(event: KeyboardEvent) {
			const target = event.target as HTMLElement | null;
			const isTyping =
				target?.isContentEditable || target?.matches('input, textarea, select, [role="textbox"]');
			if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping) {
				event.preventDefault();
				open = true;
			}
		}
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<Command.Dialog
	bind:open
	title="Search Gesso"
	description="Search courses"
	class="top-1/2! w-[min(42rem,calc(100vw-2rem))] -translate-y-1/2! rounded-2xl! border-border/60 shadow-2xl backdrop-blur-xl"
>
	<div class="border-b border-border/60 p-2">
		<Command.Input
			bind:value={query}
			class="h-11 text-base"
			placeholder="Search courses…"
			autofocus
		/>
	</div>
	<Command.List class="max-h-[min(55vh,26rem)] p-2">
		<Command.Empty class="py-12">Nothing matches that search.</Command.Empty>
		<Command.Group heading="Courses">
			{#await courses}
				<Command.Loading>Loading courses…</Command.Loading>
			{:then courseList}
				{#each courseList.filter((course) => course.name !== 'Untitled course') as course (course.id)}
					<Command.LinkItem
						href={courseHref(course.id)}
						value={`${course.name} ${course.code} ${course.term}`}
						onclick={() => (open = false)}
						class={course.previous ? 'text-muted-foreground' : undefined}
					>
						<span class="size-1 shrink-0 rounded-full" style={`background: ${course.color}`}></span>
						<span class="min-w-0 flex-1 truncate font-medium">{course.name}</span>
					</Command.LinkItem>
				{/each}
			{:catch}
				<p class="p-4 text-center text-sm text-muted-foreground">Courses are unavailable.</p>
			{/await}
		</Command.Group>
	</Command.List>
</Command.Dialog>
