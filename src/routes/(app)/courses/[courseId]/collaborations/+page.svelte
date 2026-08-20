<script lang="ts">
	import { page } from '$app/state';
	import { getCourseCollaborations } from '$lib/canvas';
	import { Input } from '$lib/components/ui/input';
	import { Search01Icon, Cancel01Icon, Share01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let query = $state('');
	let collaborations = $state<Awaited<ReturnType<typeof getCourseCollaborations>> | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let scrollEl: HTMLDivElement | undefined = $state(undefined);

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

	const filtered = $derived.by(() => {
		if (!collaborations) return [];
		const q = query.trim().toLowerCase();
		if (!q) return collaborations;
		return collaborations.filter((c) => `${c.title} ${c.type}`.toLowerCase().includes(q));
	});
</script>

<svelte:head>
	<title>Collaborations | Gesso</title>
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
						aria-label="Search collaborations"
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
						class="mt-4 text-sm font-medium text-chart-1 hover:underline"
					>
						Try again
					</button>
				</div>
			{:else if filtered.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={Share01Icon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">{query ? 'No matches' : 'No collaborations'}</p>
					<p class="mt-1 text-sm text-muted-foreground">
						{query ? 'Try a different search term.' : 'This course has no active collaborations.'}
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
					{#each filtered as c (c.id)}
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
									class="mt-3 inline-block text-xs font-medium text-chart-1 hover:underline"
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
