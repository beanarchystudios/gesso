<script lang="ts">
	import { page } from '$app/state';
	import { getCoursePages } from '$lib/canvas';
	import { Input } from '$lib/components/ui/input';
	import {
		Search01Icon,
		Cancel01Icon,
		Notebook01Icon,
		ExternalLinkIcon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let query = $state(page.url.searchParams.get('q') ?? '');
	let pages = $state<Awaited<ReturnType<typeof getCoursePages>> | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let scrollEl: HTMLDivElement | undefined = $state(undefined);

	const courseId = $derived(page.params.courseId!);

	$effect(() => {
		const id = courseId;
		let cancelled = false;
		loading = true;
		loadError = null;
		pages = null;
		getCoursePages(id)
			.then((data) => {
				if (cancelled) return;
				pages = data;
				loading = false;
			})
			.catch(() => {
				if (cancelled) return;
				loadError = 'Unable to load notebook pages.';
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
		if (!pages) return [];
		const q = query.trim().toLowerCase();
		if (!q) return pages;
		return pages.filter((p) => p.title.toLowerCase().includes(q));
	});
</script>

<svelte:head>
	<title>Notebook | Gesso</title>
</svelte:head>

<main class="flex size-full flex-col overflow-hidden bg-background">
	<div bind:this={scrollEl} class="flex-1 overflow-y-auto">
		<div class="sticky top-0 z-10 px-4 py-4 xl:px-6 2xl:px-8">
			<div class="mx-auto w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
				<div class="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						class="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-foreground/60"
					/>
					<Input
						bind:value={query}
						placeholder="Search"
						aria-label="Search notebook"
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
			class="mx-auto w-full max-w-3xl px-4 pt-2 pb-6 lg:max-w-4xl xl:max-w-5xl xl:px-6 2xl:max-w-6xl 2xl:px-8"
		>
			{#if loading}
				<div class="overflow-hidden rounded-xl border bg-card">
					<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
					{#each Array(5) as _, i (i)}
						<div
							class="flex items-center gap-3 px-4 py-3.5 {i !== 0 ? 'border-t border-border' : ''}"
						>
							<div class="size-8 animate-pulse rounded-md bg-muted"></div>
							<div class="flex-1 space-y-2">
								<div class="h-4 w-48 animate-pulse rounded bg-muted"></div>
								<div class="h-3 w-24 animate-pulse rounded bg-muted/60"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if loadError}
				<div class="rounded-xl border px-6 py-12 text-center">
					<p class="text-sm font-medium">Couldn’t load notebook</p>
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
						<HugeiconsIcon icon={Notebook01Icon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">{query ? 'No matches' : 'No pages'}</p>
					<p class="mt-1 text-sm text-muted-foreground">
						{query ? 'Try a different search term.' : 'This course has no notebook pages.'}
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
				<div class="overflow-hidden rounded-xl border bg-card">
					{#each filtered as p, idx (p.url)}
						<a
							href={p.htmlUrl}
							target="_blank"
							rel="external noreferrer"
							class="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 {idx !== 0
								? 'border-t border-border'
								: ''}"
						>
							<span
								class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
							>
								<HugeiconsIcon icon={Notebook01Icon} class="size-4" />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-medium">
									{p.title}
									{#if p.frontPage}
										<span
											class="ml-1 rounded-full bg-chart-1/10 px-1.5 py-0.5 text-[10px] font-semibold text-chart-1"
											>Front Page</span
										>
									{/if}
								</span>
								{#if p.updatedAt}
									<span class="block text-xs text-muted-foreground"
										>Updated {formatDate(p.updatedAt)}</span
									>
								{/if}
							</span>
							<HugeiconsIcon icon={ExternalLinkIcon} class="size-3.5 shrink-0 text-foreground/30" />
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
