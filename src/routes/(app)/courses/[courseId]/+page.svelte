<script lang="ts">
	import { page } from '$app/state';
	import { getCourseFrontPage, getFavoriteCourses } from '$lib/canvas';
	import { Spinner } from '$lib/components/ui/spinner';

	const coursePage = $derived(
		Promise.all([getCourseFrontPage(page.params.courseId!), getFavoriteCourses()]).then(
			([frontPage, courses]) => ({
				frontPage,
				courseName:
					courses.find((course) => course.id.toString() === page.params.courseId)?.name ??
					frontPage.title
			})
		)
	);
</script>

<svelte:head>
	{#await coursePage then coursePage}
		<title>{coursePage.courseName} | Gesso</title>
	{/await}
</svelte:head>

<main class="h-full w-full overflow-y-auto p-6 xl:p-8 2xl:p-10">
	{#await coursePage}
		<div class="flex min-h-full items-center justify-center">
			<Spinner class="size-10 text-muted-foreground" />
		</div>
	{:then coursePage}
		<article class="course-content mx-auto w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html coursePage.frontPage.body}
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
