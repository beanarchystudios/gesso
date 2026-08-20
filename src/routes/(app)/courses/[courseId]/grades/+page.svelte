<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getCourseGrades } from '$lib/canvas';
	import { Spinner } from '$lib/components/ui/spinner';

	const grades = $derived(getCourseGrades(page.params.courseId!));

	function formatDate(value: string | null) {
		if (!value) return 'No due date';
		return new Date(value).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head><title>Grades | Gesso</title></svelte:head>

<main class="size-full overflow-y-auto p-4 xl:p-6 2xl:p-8">
	<div class="mx-auto w-full max-w-5xl">
		{#await grades}
			<div class="flex min-h-64 items-center justify-center">
				<Spinner class="size-8 text-muted-foreground" />
			</div>
		{:then rows}
			{@const graded = rows.filter((row) => row.score != null && !row.excused)}
			{@const earned = graded.reduce((sum, row) => sum + (row.score ?? 0), 0)}
			{@const possible = graded.reduce((sum, row) => sum + (row.pointsPossible ?? 0), 0)}

			<header class="mb-6 flex items-end justify-between gap-4">
				<div>
					<h1 class="text-2xl font-semibold">Grades</h1>
					<p class="mt-1 text-sm text-muted-foreground">{graded.length} graded assignments</p>
				</div>
				{#if possible > 0}
					<div class="text-right">
						<p class="text-2xl font-semibold">{((earned / possible) * 100).toFixed(1)}%</p>
						<p class="text-xs text-muted-foreground">
							{earned.toLocaleString()} / {possible.toLocaleString()} points
						</p>
					</div>
				{/if}
			</header>

			{#if rows.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<p class="text-sm font-medium">No grades yet</p>
					<p class="mt-1 text-sm text-muted-foreground">Grades will appear here when available.</p>
				</div>
			{:else}
				<div class="overflow-hidden rounded-xl border bg-card">
					{#each rows as row (row.id)}
						<a
							href={resolve('/(app)/courses/[courseId]/assignments/[assignmentId]', {
								courseId: page.params.courseId!,
								assignmentId: String(row.assignmentId)
							})}
							class="flex items-center justify-between gap-4 border-b p-4 transition-colors last:border-b-0 hover:bg-muted/40"
						>
							<div class="min-w-0">
								<h2 class="truncate text-sm font-medium">{row.name}</h2>
								<p class="mt-1 text-xs text-muted-foreground">Due {formatDate(row.dueAt)}</p>
							</div>
							<div class="shrink-0 text-right">
								{#if row.excused}
									<p class="text-sm font-medium text-muted-foreground">Excused</p>
								{:else if row.score != null}
									<p class="text-sm font-semibold">
										{row.grade ?? row.score}{row.pointsPossible != null
											? ` / ${row.pointsPossible}`
											: ''}
									</p>
								{:else}
									<p class="text-sm text-muted-foreground">Not graded</p>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{:catch}
			<div class="rounded-xl border px-6 py-12 text-center">
				<p class="text-sm font-medium">Couldn’t load grades</p>
				<p class="mt-1 text-sm text-muted-foreground">Please try again later.</p>
			</div>
		{/await}
	</div>
</main>
