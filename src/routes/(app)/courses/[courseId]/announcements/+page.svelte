<script lang="ts">
	import { page } from '$app/state';
	import { getCourseAnnouncements } from '$lib/canvas';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Item from '$lib/components/ui/item';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';
	import {
		Cancel01Icon,
		ChevronDownIcon,
		LinkSquare01Icon,
		Megaphone01Icon,
		Search01Icon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SvelteSet } from 'svelte/reactivity';

	type Announcement = Awaited<ReturnType<typeof getCourseAnnouncements>>[number];
	let query = $state(page.url.searchParams.get('q') ?? '');
	let announcements = $state<Announcement[] | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let expanded = new SvelteSet<number>();
	const courseId = $derived(page.params.courseId!);

	$effect(() => {
		const id = courseId;
		let cancelled = false;
		loading = true;
		loadError = null;
		announcements = null;
		expanded.clear();
		getCourseAnnouncements(id)
			.then((data) => {
				if (!cancelled) {
					announcements = data;
					loading = false;
				}
			})
			.catch(() => {
				if (!cancelled) {
					loadError = 'Something went wrong loading this course’s announcements.';
					loading = false;
				}
			});
		return () => {
			cancelled = true;
		};
	});

	function stripHtml(html: string) {
		return html
			.replace(/<br\s*\/?\s*>/gi, '\n')
			.replace(/<\/p\s*>/gi, '\n\n')
			.replace(/<\/div\s*>/gi, '\n')
			.replace(/<li[^>]*>/gi, '• ')
			.replace(/<\/li\s*>/gi, '\n')
			.replace(/<[^>]*>/g, ' ')
			.replace(/&nbsp;/gi, ' ')
			.replace(/&amp;/gi, '&')
			.replace(/&lt;/gi, '<')
			.replace(/&gt;/gi, '>')
			.replace(/&quot;/gi, '"')
			.replace(/&#39;/gi, "'")
			.replace(/[ \t]+/g, ' ')
			.replace(/ *\n */g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}
	function initials(name: string) {
		return (
			name
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.map((part) => part[0]?.toUpperCase())
				.join('') || '?'
		);
	}
	function formatRelative(iso: string | null) {
		if (!iso) return '';
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
		if (minutes < 1) return 'now';
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h`;
		if (hours < 48) return 'yesterday';
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d`;
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
	function formatFull(iso: string | null) {
		if (!iso) return '';
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
	function toggle(id: number) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}
	const filtered = $derived.by(() => {
		if (!announcements) return [];
		const search = query.trim().toLowerCase();
		if (!search) return announcements;
		return announcements.filter((a) =>
			`${a.title} ${a.authorName} ${stripHtml(a.message)}`.toLowerCase().includes(search)
		);
	});
</script>

<svelte:head><title>Announcements | Gesso</title></svelte:head>

<main class="flex size-full flex-col overflow-hidden bg-background">
	<div class="flex-1 overflow-y-auto">
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
						aria-label="Search announcements"
						class="h-9 rounded-full border border-border/40 bg-background/85 pr-9 pl-9 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-background/85"
						autocomplete="off"
						spellcheck="false"
						disabled={loading}
					/>
					{#if query}<button
							type="button"
							aria-label="Clear search"
							onclick={() => (query = '')}
							class="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
							><HugeiconsIcon icon={Cancel01Icon} class="size-4" /></button
						>{/if}
				</div>
			</div>
		</div>

		<div
			class="mx-auto w-full max-w-3xl px-4 pt-2 pb-6 lg:max-w-4xl xl:max-w-5xl xl:px-6 2xl:max-w-6xl 2xl:px-8"
		>
			{#if loading}
				<div class="overflow-hidden rounded-xl border bg-card" aria-label="Loading announcements">
					<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
					{#each Array(5) as _, i (i)}
						<div class="flex items-start gap-3 px-4 py-3.5 {i ? 'border-t' : ''}">
							<div class="size-8 shrink-0 animate-pulse rounded-full bg-muted"></div>
							<div class="min-w-0 flex-1">
								<div class="h-4 w-32 animate-pulse rounded bg-muted"></div>
								<div class="mt-1 h-4 w-3/4 animate-pulse rounded bg-muted"></div>
								<div class="mt-1 h-4 w-full animate-pulse rounded bg-muted/70"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if loadError}
				<div class="rounded-xl border px-6 py-12 text-center">
					<p class="text-sm font-medium">Couldn’t load announcements</p>
					<p class="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{loadError}</p>
					<button
						type="button"
						onclick={() => location.reload()}
						class="mt-4 text-sm font-medium text-chart-1 hover:underline">Try again</button
					>
				</div>
			{:else if !announcements || announcements.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={Megaphone01Icon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">No announcements</p>
					<p class="mt-1 text-sm text-muted-foreground">This course has no announcements.</p>
				</div>
			{:else if filtered.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-12 text-center">
					<p class="text-sm font-medium">No matches</p>
					<p class="mt-1 text-sm text-muted-foreground">Try a different search term.</p>
					<button
						type="button"
						onclick={() => (query = '')}
						class="mt-3 text-sm font-medium text-chart-1 hover:underline">Clear search</button
					>
				</div>
			{:else}
				<div class="overflow-hidden rounded-xl border bg-card">
					{#each filtered as announcement, i (announcement.id)}
						{@const isExpanded = expanded.has(announcement.id)}
						{@const body = stripHtml(announcement.message)}
						<Item.Root
							variant="default"
							class="group flex-col items-stretch gap-0 rounded-none border-0 px-0 py-0 text-left hover:bg-muted/40 focus-visible:bg-muted/40 {i
								? 'border-t border-border'
								: ''} {isExpanded ? 'bg-muted/20' : ''}"
							role="button"
							tabindex={0}
							aria-expanded={isExpanded}
							onclick={() => toggle(announcement.id)}
							onkeydown={(event: KeyboardEvent) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									toggle(announcement.id);
								}
							}}
						>
							<div class="flex w-full items-start gap-3 px-4 py-3.5">
								<Avatar.Root class="size-8 shrink-0"
									>{#if announcement.authorAvatar}<Avatar.Image
											src={announcement.authorAvatar}
											alt=""
										/>{/if}<Avatar.Fallback class="bg-secondary text-xs font-medium text-foreground"
										>{initials(announcement.authorName)}</Avatar.Fallback
									></Avatar.Root
								>
								<div class="min-w-0 flex-1">
									<div class="flex items-baseline gap-2">
										<span class="truncate text-sm font-medium text-foreground/90"
											>{announcement.authorName}</span
										><span
											class="ml-auto shrink-0 text-xs font-medium text-foreground/60 tabular-nums"
											>{formatRelative(announcement.postedAt)}</span
										>
									</div>
									<div class="mt-0.5 truncate text-sm leading-snug font-medium">
										{announcement.title}
									</div>
									<div class="mt-0.5 line-clamp-1 text-sm text-foreground/70">
										{body || 'No content.'}
									</div>
									{#if announcement.replyCount > 0}<div
											class="mt-1 text-xs font-medium text-foreground/60"
										>
											{announcement.replyCount} repl{announcement.replyCount === 1 ? 'y' : 'ies'}
										</div>{/if}
								</div>
								<span
									class="mt-1 ml-1 shrink-0 text-foreground/40 transition-transform duration-150 ease-out {isExpanded
										? 'rotate-180'
										: 'rotate-0'}"><HugeiconsIcon icon={ChevronDownIcon} class="size-4" /></span
								>
							</div>
							<div
								class="grid w-full transition-[grid-template-rows] duration-150 ease-out"
								style:grid-template-rows={isExpanded ? '1fr' : '0fr'}
								aria-hidden={!isExpanded}
							>
								<div class="min-h-0 overflow-hidden">
									<Separator />
									<div class="px-4 py-4">
										<div class="flex items-baseline gap-2">
											<span class="text-sm font-medium">{announcement.authorName}</span><span
												class="text-xs font-medium text-foreground/60"
												>{formatFull(announcement.postedAt)}</span
											>
										</div>
										<p class="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
											{body || 'No content.'}
										</p>
										{#if announcement.htmlUrl}<a
												href={announcement.htmlUrl}
												target="_blank"
												rel="external noreferrer"
												onclick={(event) => event.stopPropagation()}
												class="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-chart-1 hover:underline"
												><HugeiconsIcon icon={LinkSquare01Icon} class="size-3.5" />Open in Canvas</a
											>{/if}
									</div>
								</div>
							</div>
						</Item.Root>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
