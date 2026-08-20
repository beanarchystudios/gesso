<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getCourseAssignments } from '$lib/canvas';
	import { Input } from '$lib/components/ui/input';
	import {
		Search01Icon,
		Cancel01Icon,
		Task01Icon,
		Calendar03Icon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let query = $state('');
	let assignments = $state<Awaited<ReturnType<typeof getCourseAssignments>> | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let scrollEl: HTMLDivElement | undefined = $state(undefined);

	const courseId = $derived(page.params.courseId!);

	$effect(() => {
		const id = courseId;
		let cancelled = false;
		loading = true;
		loadError = null;
		assignments = null;
		getCourseAssignments(id)
			.then((data) => {
				if (cancelled) return;
				assignments = data;
				loading = false;
			})
			.catch(() => {
				if (cancelled) return;
				loadError = 'Unable to load assignments.';
				loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	function stripHtml(html: string) {
		return html
			.replace(/<[^>]*>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/\s+/g, ' ')
			.trim();
	}

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

	const filtered = $derived.by(() => {
		if (!assignments) return [];
		const q = query.trim().toLowerCase();
		if (!q) return assignments;
		return assignments.filter((a) => {
			const hay =
				`${a.name} ${stripHtml(a.description)} ${a.submissionTypes.join(' ')}`.toLowerCase();
			return hay.includes(q);
		});
	});

	const sorted = $derived.by(() => {
		return [...filtered].sort((a, b) => {
			if (!a.dueAt && !b.dueAt) return 0;
			if (!a.dueAt) return 1;
			if (!b.dueAt) return -1;
			return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
		});
	});
</script>

<svelte:head>
	<title>Assignments | Gesso</title>
</svelte:head>

<main class="flex size-full flex-col overflow-hidden bg-background">
	<div bind:this={scrollEl} class="flex-1 overflow-y-auto">
		<div class="sticky top-0 z-10 px-4 py-4 xl:px-6 2xl:px-8">
			<div class="mx-auto w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-7xl">
				<div class="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						class="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-foreground/60"
					/>
					<Input
						bind:value={query}
						placeholder="Search"
						aria-label="Search assignments"
						class="h-9 rounded-full border border-border/40 bg-background/85 pr-9 pl-9 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-background/85"
						autocomplete="off"
						spellcheck="false"
						disabled={loading}
					/>
					{#if query}
						<button
							type="button"
							aria-label="Clear search"
							onclick={() => (query = '')}
							class="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							<HugeiconsIcon icon={Cancel01Icon} class="size-4" />
						</button>
					{/if}
				</div>
			</div>
		</div>

		<div
			class="mx-auto w-full max-w-3xl px-4 pt-2 pb-6 lg:max-w-4xl xl:max-w-5xl xl:px-6 2xl:max-w-7xl 2xl:px-8"
		>
			{#if loading}
				<div class="space-y-3">
					<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
					{#each Array(4) as _, i (i)}
						<div class="animate-pulse rounded-xl border bg-card p-4">
							<div class="h-4 w-2/3 rounded bg-muted"></div>
							<div class="mt-2 h-3 w-1/3 rounded bg-muted/60"></div>
							<div class="mt-3 h-3 w-full rounded bg-muted/40"></div>
						</div>
					{/each}
				</div>
			{:else if loadError}
				<div class="rounded-xl border px-6 py-12 text-center">
					<p class="text-sm font-medium">Couldn’t load assignments</p>
					<p class="mt-1 text-sm text-muted-foreground">{loadError}</p>
					<button
						type="button"
						onclick={() => location.reload()}
						class="mt-4 text-sm font-medium text-chart-1 hover:underline"
					>
						Try again
					</button>
				</div>
			{:else if sorted.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={Task01Icon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">{query ? 'No matches' : 'No assignments'}</p>
					<p class="mt-1 text-sm text-muted-foreground">
						{query ? 'Try a different search term.' : 'This course has no assignments.'}
					</p>
					{#if query}
						<button
							type="button"
							onclick={() => (query = '')}
							class="mt-3 text-sm font-medium text-chart-1 hover:underline"
						>
							Clear search
						</button>
					{/if}
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:gap-4 2xl:gap-5">
					{#each sorted as a (a.id)}
						<a
							href={resolve('/(app)/courses/[courseId]/assignments/[assignmentId]', {
								courseId,
								assignmentId: String(a.id)
							})}
							class="block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
						>
							<div class="flex items-start justify-between gap-3">
								<h2 class="text-sm leading-snug font-semibold">{a.name}</h2>
								{#if a.pointsPossible != null}
									<span class="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium">
										{a.pointsPossible} pts
									</span>
								{/if}
							</div>
							{#if formatDue(a.dueAt) || a.submissionTypes.length}
								<div
									class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
								>
									{#if formatDue(a.dueAt)}
										<span class="inline-flex items-center gap-1.5">
											<HugeiconsIcon icon={Calendar03Icon} class="size-3.5" />
											<span class={isOverdue(a.dueAt) ? 'font-medium text-destructive' : ''}>
												{formatDue(a.dueAt)}
											</span>
										</span>
									{/if}
									{#each a.submissionTypes as type, i (type)}
										{#if formatDue(a.dueAt) || i > 0}
											<span aria-hidden="true" class="text-foreground/30 select-none">·</span>
										{/if}
										<span>{formatSubmissionType(type)}</span>
									{/each}
								</div>
							{/if}
							{#if stripHtml(a.description)}
								<p class="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground/70">
									{stripHtml(a.description).slice(0, 220)}
								</p>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
