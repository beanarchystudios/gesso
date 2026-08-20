<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getCoursePage } from '$lib/canvas';
	import { Spinner } from '$lib/components/ui/spinner';
	import { ArrowLeft01Icon, Calendar03Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	const courseId = $derived(page.params.courseId!);
	const pageUrl = $derived(page.params.pageUrl!);
	const coursePage = $derived(getCoursePage(courseId, pageUrl));
	const fromModules = $derived(page.url.searchParams.get('from') === 'modules');
	const backHref = $derived(
		fromModules
			? resolve('/(app)/courses/[courseId]/modules', { courseId })
			: resolve('/(app)/courses/[courseId]/notebook', { courseId })
	);
	const backLabel = $derived(fromModules ? 'Back to modules' : 'Back to notebook');

	function formatDate(iso: string | null) {
		if (!iso) return null;
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return null;
		return date.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	{#await coursePage then currentPage}
		<title>{currentPage.title} | Gesso</title>
	{/await}
</svelte:head>

<main class="h-full w-full overflow-y-auto">
	<div class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:max-w-4xl xl:max-w-5xl xl:px-8">
		<a
			href={backHref}
			class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-chart-1"
		>
			<HugeiconsIcon icon={ArrowLeft01Icon} class="size-4" />
			{backLabel}
		</a>

		{#await coursePage}
			<div class="mt-8 flex min-h-48 items-center justify-center">
				<Spinner class="size-10 text-muted-foreground" />
			</div>
		{:then currentPage}
			<header class="mt-8">
				<div class="flex items-start justify-between gap-4">
					<h1 class="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
						{currentPage.title}
					</h1>
					{#if currentPage.frontPage}
						<span
							class="shrink-0 rounded-full bg-chart-1/10 px-3 py-1 text-sm font-medium text-chart-1"
						>
							Front page
						</span>
					{/if}
				</div>
				{#if formatDate(currentPage.updatedAt)}
					<p class="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
						<HugeiconsIcon icon={Calendar03Icon} class="size-4" />
						Updated {formatDate(currentPage.updatedAt)}
					</p>
				{/if}
			</header>

			<div class="mt-10 border-t pt-8">
				{#if currentPage.body.trim()}
					<article class="course-content max-w-none">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html currentPage.body}
					</article>
				{:else}
					<p class="text-muted-foreground italic">This page has no content.</p>
				{/if}
			</div>
		{:catch err}
			<div class="mt-8 rounded-xl border px-6 py-12 text-center">
				<p class="text-sm font-medium">Couldn’t load page</p>
				<p class="mt-1 text-sm text-muted-foreground">
					{err instanceof Error ? err.message : 'Unable to load this page.'}
				</p>
				<a
					href={backHref}
					class="mt-4 inline-block text-sm font-medium text-chart-1 hover:underline"
				>
					{backLabel}
				</a>
			</div>
		{/await}
	</div>
</main>

<style>
	.course-content :global(img),
	.course-content :global(video),
	.course-content :global(iframe) {
		max-width: 100%;
		border-radius: var(--radius-lg);
	}
	.course-content :global(a) {
		color: var(--chart-1);
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
		color: var(--chart-1) !important;
	}
	.course-content :global(p),
	.course-content :global(ul),
	.course-content :global(ol) {
		margin-block: 1rem;
		font-size: 1.0625rem;
		line-height: 1.7;
	}
	.course-content :global(h1),
	.course-content :global(h2),
	.course-content :global(h3) {
		margin-block: 1.5rem 0.75rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
</style>
