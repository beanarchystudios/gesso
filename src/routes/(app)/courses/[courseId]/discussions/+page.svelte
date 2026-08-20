<script lang="ts">
	import { page } from '$app/state';
	import { getCourseDiscussions } from '$lib/canvas';
	import { Input } from '$lib/components/ui/input';
	import { Search01Icon, Cancel01Icon, BubbleChatIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	let query = $state('');
	let discussions = $state<Awaited<ReturnType<typeof getCourseDiscussions>> | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	const courseId = $derived(page.params.courseId!);
	$effect(() => {
		const id = courseId;
		let cancelled = false;
		loading = true;
		loadError = null;
		discussions = null;
		getCourseDiscussions(id)
			.then((data) => {
				if (cancelled) return;
				discussions = data;
				loading = false;
			})
			.catch(() => {
				if (cancelled) return;
				loadError = 'Unable to load discussions.';
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
	function formatDate(iso: string | null) {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
	const filtered = $derived.by(() => {
		if (!discussions) return [];
		const q = query.trim().toLowerCase();
		if (!q) return discussions;
		return discussions.filter((d) => {
			const hay = `${d.title} ${d.authorName} ${stripHtml(d.message)}`.toLowerCase();
			return hay.includes(q);
		});
	});
</script>

<svelte:head>
	<title>Discussions | Gesso</title>
</svelte:head>
<main class="flex size-full flex-col overflow-hidden bg-background">
	<div class="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-4">
		<div class="relative shrink-0">
			<HugeiconsIcon
				icon={Search01Icon}
				class="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-foreground/60"
			/>
			<Input
				bind:value={query}
				placeholder="Search discussions"
				aria-label="Search discussions"
				class="h-9 rounded-full border border-border/40 bg-background pr-9 pl-9"
				autocomplete="off"
				disabled={loading}
			/>
			{#if query}
				<button
					type="button"
					aria-label="Clear search"
					onclick={() => (query = '')}
					class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<HugeiconsIcon icon={Cancel01Icon} class="size-4" />
				</button>
			{/if}
		</div>
		<div class="mt-4 flex-1 overflow-y-auto pb-6">
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
					<p class="text-sm font-medium">Couldn’t load discussions</p>
					<p class="mt-1 text-sm text-muted-foreground">{loadError}</p>
					<button
						type="button"
						onclick={() => location.reload()}
						class="mt-4 text-sm font-medium text-primary hover:underline"
					>
						Try again
					</button>
				</div>
			{:else if filtered.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={BubbleChatIcon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">{query ? 'No matches' : 'No discussions'}</p>
					<p class="mt-1 text-sm text-muted-foreground">
						{query ? 'Try a different search term.' : 'This course has no discussions.'}
					</p>
					{#if query}
						<button
							type="button"
							onclick={() => (query = '')}
							class="mt-3 text-sm font-medium text-primary hover:underline"
						>
							Clear search
						</button>
					{/if}
				</div>
			{:else}
				<div class="space-y-3">
					{#each filtered as d (d.id)}
						<article class="rounded-xl border bg-card p-4">
							<h2 class="text-sm leading-snug font-semibold">{d.title}</h2>
							<p class="mt-1 text-xs text-muted-foreground">
								{d.authorName} · {formatDate(d.postedAt)}
								{#if d.replyCount}· {d.replyCount} repl{d.replyCount === 1 ? 'y' : 'ies'}{/if}
								{#if d.locked}· locked{/if}
							</p>
							{#if stripHtml(d.message)}
								<p class="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/80">
									{stripHtml(d.message).slice(0, 280)}
								</p>
							{/if}
							{#if d.htmlUrl}
								<a
									href={d.htmlUrl}
									target="_blank"
									rel="external noreferrer"
									class="mt-3 inline-block text-xs font-medium text-primary hover:underline"
								>
									Open in Canvas
								</a>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
