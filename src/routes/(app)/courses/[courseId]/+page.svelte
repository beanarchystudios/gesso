<script lang="ts">
	import { page } from '$app/state';
	import { getCourseFrontPage } from '$lib/canvas.remote';
	import { Spinner } from '$lib/components/ui/spinner';

	const frontPage = $derived(getCourseFrontPage(page.params.courseId!));
</script>

<svelte:head>
	<title>Course | Gesso</title>
</svelte:head>

<main class="h-full w-full overflow-y-auto p-6">
	{#await frontPage}
		<div class="flex min-h-full items-center justify-center">
			<Spinner class="size-10 text-muted-foreground" />
		</div>
	{:then frontPage}
		<article class="course-content mx-auto w-full max-w-5xl">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html frontPage.body}
		</article>
	{:catch}
		<p class="text-destructive">Unable to load the course front page.</p>
	{/await}
</main>

<style>
	.course-content :global(img),
	.course-content :global(video),
	.course-content :global(iframe) {
		max-width: 100%;
	}

	.course-content :global(a) {
		color: var(--course-color, var(--primary));
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	:global(.dark) .course-content :global(img) {
		filter: invert(1);
	}

	:global(.dark) .course-content,
	:global(.dark) .course-content :global(*) {
		color: inherit !important;
	}

	:global(.dark) .course-content :global(a) {
		color: var(--course-color, var(--primary)) !important;
	}

	.course-content :global(p),
	.course-content :global(ul),
	.course-content :global(ol) {
		margin-block: 0.75rem;
	}
</style>
