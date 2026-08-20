<script lang="ts">
	import { page } from '$app/state';
	import { getCourseDetails } from '$lib/canvas';
	import { Spinner } from '$lib/components/ui/spinner';
	const courseDetails = $derived(getCourseDetails(page.params.courseId!));
</script>

<svelte:head>
	{#await courseDetails then details}
		<title>Syllabus — {details.name} | Gesso</title>
	{/await}
</svelte:head>
<main class="h-full w-full overflow-y-auto p-6 xl:p-8 2xl:p-10">
	{#await courseDetails}
		<div class="flex min-h-full items-center justify-center">
			<Spinner class="size-10 text-muted-foreground" />
		</div>
	{:then details}
		<article
			class="course-content mx-auto w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl"
		>
			{#if details.syllabusBody}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html details.syllabusBody}
			{:else}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<p class="text-sm font-medium">No syllabus</p>
					<p class="mt-1 text-sm text-muted-foreground">This course has no syllabus content.</p>
					{#if details.htmlUrl}
						<a
							href={details.htmlUrl}
							target="_blank"
							rel="external noreferrer"
							class="mt-3 inline-block text-sm font-medium text-chart-1 hover:underline"
						>
							Open in Canvas
						</a>
					{/if}
				</div>
			{/if}
		</article>
	{:catch}
		<p class="text-destructive">Unable to load syllabus.</p>
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
