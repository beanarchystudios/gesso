<script lang="ts">
	import { page } from '$app/state';
	import { getCourseCollaborations } from '$lib/canvas';
	import { Share01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	let collaborations = $state<Awaited<ReturnType<typeof getCourseCollaborations>> | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	const courseId = $derived(page.params.courseId!);
	$effect(() => {
		const id = courseId;
		let cancelled = false;
		loading = true;
		loadError = null;
		collaborations = null;
		getCourseCollaborations(id)
			.then((data) => {
				if (cancelled) return;
				collaborations = data;
				loading = false;
			})
			.catch(() => {
				if (cancelled) return;
				loadError = 'Unable to load collaborations.';
				loading = false;
			});
		return () => {
			cancelled = true;
		};
	});
	function formatDate(iso: string | null) {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Collaborations | Gesso</title>
</svelte:head>
<main class="flex size-full flex-col overflow-hidden bg-background">
	<div class="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-4">
		<div class="flex-1 overflow-y-auto pb-6">
			{#if loading}
				<div class="space-y-3">
					<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
					{#each Array(3) as _, i (i)}
						<div class="animate-pulse rounded-xl border bg-card p-4">
							<div class="h-4 w-1/2 rounded bg-muted"></div>
							<div class="mt-2 h-3 w-1/3 rounded bg-muted/60"></div>
						</div>
					{/each}
				</div>
			{:else if loadError}
				<div class="rounded-xl border px-6 py-12 text-center">
					<p class="text-sm font-medium">Couldn’t load collaborations</p>
					<p class="mt-1 text-sm text-muted-foreground">{loadError}</p>
					<button
						type="button"
						onclick={() => location.reload()}
						class="mt-4 text-sm font-medium text-primary hover:underline"
					>
						Try again
					</button>
				</div>
			{:else if !collaborations || collaborations.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={Share01Icon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">No collaborations</p>
					<p class="mt-1 text-sm text-muted-foreground">
						This course has no active collaborations.
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each collaborations as c (c.id)}
						<article class="rounded-xl border bg-card p-4">
							<h2 class="text-sm font-semibold">{c.title}</h2>
							<p class="mt-1 text-xs text-muted-foreground">
								{c.type}
								{#if c.createdAt}· {formatDate(c.createdAt)}{/if}
							</p>
							{#if c.url}
								<a
									href={c.url}
									target="_blank"
									rel="external noreferrer"
									class="mt-3 inline-block text-xs font-medium text-primary hover:underline"
								>
									Open
								</a>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
