<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getCourseAssignment } from '$lib/canvas';
	import { Spinner } from '$lib/components/ui/spinner';
	import { ArrowLeft01Icon, Calendar03Icon, Task01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	const courseId = $derived(page.params.courseId!);
	const assignmentId = $derived(page.params.assignmentId!);
	const assignment = $derived(getCourseAssignment(courseId, assignmentId));

	function formatDue(iso: string | null) {
		if (!iso) return null;
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return null;
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function isOverdue(iso: string | null) {
		if (!iso) return false;
		const d = new Date(iso);
		return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
	}

	function formatSubmissionType(type: string) {
		const labels: Record<string, string> = {
			online_text_entry: 'Text Entry',
			online_url: 'Website URL',
			online_upload: 'File Upload',
			media_recording: 'Media Recording',
			student_annotation: 'Annotation',
			external_tool: 'External Tool',
			on_paper: 'On Paper',
			none: 'No Submission',
			discussion_topic: 'Discussion'
		};
		if (labels[type]) return labels[type];
		return type
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	function formatGradingType(type: string | null) {
		if (!type) return null;
		const labels: Record<string, string> = {
			points: 'Points',
			percent: 'Percentage',
			letter_grade: 'Letter Grade',
			gpa_scale: 'GPA Scale',
			pass_fail: 'Complete / Incomplete',
			not_graded: 'Not Graded'
		};
		return labels[type] ?? formatSubmissionType(type);
	}
</script>

<svelte:head>
	{#await assignment then a}
		<title>{a.name} | Gesso</title>
	{/await}
</svelte:head>

<main class="h-full w-full overflow-y-auto">
	<div class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:max-w-4xl xl:max-w-5xl xl:px-8">
		<a
			href={resolve('/(app)/courses/[courseId]/assignments', { courseId })}
			class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-chart-1"
		>
			<HugeiconsIcon icon={ArrowLeft01Icon} class="size-4" />
			Back to assignments
		</a>

		{#await assignment}
			<div class="mt-8 flex min-h-48 items-center justify-center">
				<Spinner class="size-10 text-muted-foreground" />
			</div>
		{:then a}
			<header class="mt-8">
				<div class="flex items-start justify-between gap-4">
					<h1 class="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
						{a.name}
					</h1>
					{#if a.pointsPossible != null}
						<span
							class="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-medium whitespace-nowrap"
						>
							{a.pointsPossible} pts
						</span>
					{/if}
				</div>

				<div
					class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-sm text-muted-foreground"
				>
					{#if formatDue(a.dueAt)}
						<span class="inline-flex items-center gap-1.5">
							<HugeiconsIcon icon={Calendar03Icon} class="size-4" />
							<span class={isOverdue(a.dueAt) ? 'font-medium text-destructive' : ''}>
								Due {formatDue(a.dueAt)}
							</span>
						</span>
					{/if}
					{#if a.submissionTypes.length}
						{#if formatDue(a.dueAt)}
							<span aria-hidden="true" class="text-foreground/30 select-none">·</span>
						{/if}
						<span class="inline-flex items-center gap-1.5">
							<HugeiconsIcon icon={Task01Icon} class="size-4" />
							<span class="inline-flex items-center gap-x-2">
								{#each a.submissionTypes as type, i (type)}
									{#if i > 0}
										<span aria-hidden="true" class="text-foreground/30 select-none">·</span>
									{/if}
									<span>{formatSubmissionType(type)}</span>
								{/each}
							</span>
						</span>
					{/if}
					{#if formatGradingType(a.gradingType)}
						<span aria-hidden="true" class="text-foreground/30 select-none">·</span>
						<span>{formatGradingType(a.gradingType)}</span>
					{/if}
					{#if a.allowedAttempts != null}
						<span aria-hidden="true" class="text-foreground/30 select-none">·</span>
						<span>{a.allowedAttempts} attempt{a.allowedAttempts === 1 ? '' : 's'}</span>
					{/if}
				</div>

				{#if a.unlockAt || a.lockAt}
					<div
						class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
					>
						{#if a.unlockAt}
							<span>Unlocks {formatDue(a.unlockAt)}</span>
						{/if}
						{#if a.unlockAt && a.lockAt}
							<span aria-hidden="true" class="text-foreground/30 select-none">·</span>
						{/if}
						{#if a.lockAt}
							<span>Locks {formatDue(a.lockAt)}</span>
						{/if}
					</div>
				{/if}
			</header>

			<div class="mt-10 border-t pt-8">
				{#if a.description && a.description.trim()}
					<article class="course-content max-w-none">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html a.description}
					</article>
				{:else}
					<p class="text-muted-foreground italic">No description provided.</p>
				{/if}
			</div>
		{:catch err}
			<div class="mt-8 rounded-xl border px-6 py-12 text-center">
				<p class="text-sm font-medium">Couldn’t load assignment</p>
				<p class="mt-1 text-sm text-muted-foreground">
					{err instanceof Error ? err.message : 'Unable to load this assignment.'}
				</p>
				<a
					href={resolve('/(app)/courses/[courseId]/assignments', { courseId })}
					class="mt-4 inline-block text-sm font-medium text-chart-1 hover:underline"
				>
					Back to assignments
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
