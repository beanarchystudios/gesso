<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import * as Item from '$lib/components/ui/item';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Separator } from '$lib/components/ui/separator';
	import { Spinner } from '$lib/components/ui/spinner';
	import { getConversations, getConversation } from '$lib/canvas';
	import {
		Search01Icon,
		Cancel01Icon,
		ChevronDownIcon,
		Mail01Icon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Virtualizer } from 'virtua/svelte';

	type ConversationView = {
		id: string;
		subject: string;
		snippet: string;
		preview: string;
		unread: boolean;
		participants: { id: number; name: string; avatarUrl: string | null }[];
		participantNames: string;
		contextName: string | null;
		lastMessageAt: string | null;
		time: string;
		timestamp: string;
	};

	let query = $state('');
	let expanded = new SvelteSet<string>();
	let convs = $state<ConversationView[] | null>(null);
	let loadError = $state<string | null>(null);
	let loading = $state(true);
	let scrollEl: HTMLDivElement | undefined = $state(undefined);

	function stripHtml(html: string): string {
		return html
			.replace(/<[^>]*>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function initials(name: string) {
		return (
			name
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.map((p) => p[0]?.toUpperCase())
				.join('') || '?'
		);
	}

	function formatRelative(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const diff = Date.now() - d.getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'now';
		if (mins < 60) return `${mins}m`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h`;
		if (hours < 48) return 'yesterday';
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d`;
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function formatFull(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function toView(raw: Awaited<ReturnType<typeof getConversations>>[number]): ConversationView {
		const stripped = stripHtml(raw.lastMessage ?? '');
		const snippet = stripped.length > 120 ? stripped.slice(0, 120) + '…' : stripped || 'No preview';
		return {
			id: String(raw.id),
			subject: raw.subject || '(No subject)',
			snippet,
			preview: stripped,
			unread: raw.unread,
			participants: raw.participants,
			participantNames: raw.participants.map((p) => p.name).join(', ') || 'Unknown',
			contextName: raw.contextName,
			lastMessageAt: raw.lastMessageAt,
			time: formatRelative(raw.lastMessageAt),
			timestamp: formatFull(raw.lastMessageAt)
		};
	}

	$effect(() => {
		let cancelled = false;
		getConversations()
			.then((raw) => {
				if (cancelled) return;
				const mapped = raw.map(toView).sort((a, b) => {
					const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
					const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
					return bt - at;
				});
				convs = mapped;
				loading = false;
			})
			.catch(() => {
				if (cancelled) return;
				loadError = 'Something went wrong loading your inbox.';
				loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	function toggle(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}

	function fuzzyScore(pattern: string, text: string): number {
		const q = pattern.toLowerCase().trim();
		const t = text.toLowerCase();
		if (!q) return 0;
		if (t.includes(q)) return 100 + q.length * 2;
		let qi = 0;
		let ti = 0;
		let score = 0;
		let consecutive = 0;
		let lastMatch = -2;
		while (qi < q.length && ti < t.length) {
			if (q[qi] === t[ti]) {
				score += 10;
				if (lastMatch === ti - 1) {
					consecutive++;
					score += 5 + consecutive * 2;
				} else consecutive = 0;
				lastMatch = ti;
				qi++;
			} else consecutive = 0;
			ti++;
		}
		if (qi !== q.length) return -1;
		score -= Math.floor(t.length / 30);
		return score;
	}

	function messageScore(q: string, m: ConversationView): number {
		if (!q.trim()) return 1;
		const fields = [m.subject, m.snippet, m.preview, m.participantNames, m.contextName ?? ''];
		let best = -1;
		for (const f of fields) best = Math.max(best, fuzzyScore(q, f));
		return best;
	}

	let filtered = $derived.by(() => {
		if (!convs) return [];
		const q = query.trim();
		if (!q) return convs;
		return convs
			.map((m) => ({ m, s: messageScore(q, m) }))
			.filter((x) => x.s >= 0)
			.sort((a, b) => b.s - a.s)
			.map((x) => x.m);
	});
</script>

<svelte:head>
	<title>Inbox | Gesso</title>
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
						aria-label="Search inbox"
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
			class="mx-auto w-full max-w-3xl px-4 pt-4 pb-6 lg:max-w-4xl xl:max-w-5xl xl:px-6 2xl:max-w-6xl 2xl:px-8"
		>
			{#if loading}
				<div
					class="overflow-hidden rounded-xl border bg-card"
					aria-hidden="true"
					aria-label="Loading conversations"
				>
					<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
					{#each Array(5) as _, i (i)}
						<div
							class="flex w-full items-start gap-3 px-4 py-3.5 {i !== 0
								? 'border-t border-border'
								: ''}"
						>
							<div class="size-8 shrink-0 animate-pulse rounded-full bg-muted"></div>
							<div class="min-w-0 flex-1">
								<div class="flex items-baseline gap-2">
									<div class="h-4 w-28 animate-pulse rounded bg-muted sm:w-40"></div>
									<div class="ml-auto h-3 w-10 shrink-0 animate-pulse rounded bg-muted/60"></div>
								</div>
								<div class="mt-0.5 h-4 w-3/4 animate-pulse rounded bg-muted"></div>
								<div class="mt-0.5 h-4 w-full animate-pulse rounded bg-muted/70"></div>
								<div class="mt-1 h-3 w-24 animate-pulse rounded bg-muted/60"></div>
							</div>
							<div class="mt-1 size-4 shrink-0 animate-pulse rounded bg-muted/40"></div>
						</div>
					{/each}
				</div>
			{:else if loadError}
				<div class="rounded-xl border px-6 py-12 text-center">
					<p class="text-sm font-medium">Couldn’t load inbox</p>
					<p class="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{loadError}</p>
					<button
						type="button"
						onclick={() => location.reload()}
						class="mt-4 text-sm font-medium text-chart-1 hover:underline"
					>
						Try again
					</button>
				</div>
			{:else if !convs || convs.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={Mail01Icon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">No conversations</p>
					<p class="mt-1 text-sm text-muted-foreground">You’re all caught up.</p>
				</div>
			{:else if filtered.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-12 text-center">
					<p class="text-sm font-medium">No matches</p>
					<p class="mt-1 text-sm text-muted-foreground">Try a different search term.</p>
					<button
						type="button"
						onclick={() => (query = '')}
						class="mt-3 text-sm font-medium text-chart-1 hover:underline"
					>
						Clear search
					</button>
				</div>
			{:else}
				<div class="overflow-hidden rounded-xl border bg-card">
					<Virtualizer data={filtered} getKey={(c) => c.id} scrollRef={scrollEl}>
						{#snippet children(conv: ConversationView, idx: number)}
							{@const isExpanded = expanded.has(conv.id)}
							<Item.Root
								variant="default"
								class="group flex-col items-stretch gap-0 rounded-none border-0 px-0 py-0 text-left hover:bg-muted/40 focus-visible:bg-muted/40 {idx !==
								0
									? 'border-t border-border'
									: ''} {isExpanded ? 'bg-muted/20' : ''}"
								role="button"
								tabindex={0}
								aria-expanded={isExpanded}
								onclick={() => toggle(conv.id)}
								onkeydown={(e: KeyboardEvent) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										toggle(conv.id);
									}
								}}
							>
								<div class="flex w-full items-start gap-3 px-4 py-3.5">
									<Avatar.Root class="size-8 shrink-0">
										{#if conv.participants[0]?.avatarUrl}
											<Avatar.Image src={conv.participants[0].avatarUrl!} alt="" />
										{/if}
										<Avatar.Fallback class="bg-secondary text-xs font-medium text-foreground">
											{initials(conv.participants[0]?.name ?? conv.participantNames)}
										</Avatar.Fallback>
									</Avatar.Root>

									<div class="min-w-0 flex-1">
										<div class="flex items-baseline gap-2">
											<span
												class="truncate text-sm {conv.unread
													? 'font-semibold'
													: 'font-medium text-foreground/90'}"
											>
												{conv.participantNames}
											</span>
											{#if conv.unread}
												<span class="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true"
												></span>
											{/if}
											<span
												class="ml-auto shrink-0 text-xs font-medium text-foreground/60 tabular-nums"
												>{conv.time}</span
											>
										</div>

										<div
											class="mt-0.5 truncate text-sm leading-snug {conv.unread
												? 'font-medium'
												: ''}"
										>
											{conv.subject}
										</div>

										<div class="mt-0.5 line-clamp-1 text-sm text-foreground/70">
											{conv.snippet}
										</div>
										{#if conv.contextName}
											<div class="mt-1 text-xs font-medium text-foreground/60">
												{conv.contextName}
											</div>
										{/if}
									</div>

									<span
										class="mt-1 ml-1 shrink-0 text-foreground/40 transition-transform duration-150 ease-out {isExpanded
											? 'rotate-180'
											: 'rotate-0'}"
									>
										<HugeiconsIcon icon={ChevronDownIcon} class="size-4" />
									</span>
								</div>

								<div
									class="grid w-full transition-[grid-template-rows] duration-150 ease-out"
									style:grid-template-rows={isExpanded ? '1fr' : '0fr'}
									aria-hidden={!isExpanded}
								>
									<div class="min-h-0 overflow-hidden">
										<Separator />
										<div class="px-4 py-4">
											{#if conv.contextName}
												<div class="mb-3 text-xs font-medium text-foreground/60">
													{conv.contextName} · {conv.timestamp}
												</div>
											{:else}
												<div class="mb-3 text-xs font-medium text-foreground/60">
													{conv.timestamp}
												</div>
											{/if}

											{#await getConversation(conv.id)}
												<div class="flex items-center gap-2 py-4 text-sm text-foreground/70">
													<Spinner class="size-4" /> Loading…
												</div>
											{:then thread}
												<div class="space-y-5">
													{#each thread.messages as msg, i (msg.id)}
														{@const author =
															thread.participants.find((p) => p.id === msg.authorId)?.name ??
															conv.participants.find((p) => p.id === msg.authorId)?.name ??
															'Unknown'}
														<div class="space-y-1.5">
															<div class="flex items-baseline gap-2">
																<span class="text-sm font-medium">{author}</span>
																<span class="text-xs font-medium text-foreground/60"
																	>{formatFull(msg.createdAt)}</span
																>
															</div>
															<p
																class="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90"
															>
																{stripHtml(msg.body) || '—'}
															</p>
														</div>
														{#if i < thread.messages.length - 1}
															<Separator class="opacity-50" />
														{/if}
													{:else}
														<p
															class="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80"
														>
															{conv.preview || 'No content.'}
														</p>
													{/each}
												</div>
											{:catch}
												<p class="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
													{conv.preview || 'No content.'}
												</p>
											{/await}

											<div class="mt-5">
												<a
													href="https://valpok12.instructure.com/conversations"
													target="_blank"
													rel="noreferrer"
													onclick={(e) => e.stopPropagation()}
													class="text-sm font-medium text-chart-1 underline-offset-4 hover:underline"
												>
													Open in Canvas
												</a>
											</div>
										</div>
									</div>
								</div>
							</Item.Root>
						{/snippet}
					</Virtualizer>
				</div>
			{/if}
		</div>
	</div>
</main>
