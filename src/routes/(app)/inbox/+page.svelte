<script lang="ts">
	import { page } from '$app/state';
	import { Input } from '$lib/components/ui/input';
	import * as Item from '$lib/components/ui/item';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Separator } from '$lib/components/ui/separator';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		bulkUpdateConversations,
		getConversation,
		getConversations,
		replyToConversation,
		updateConversation
	} from '$lib/canvas';
	import {
		Search01Icon,
		Cancel01Icon,
		ChevronDownIcon,
		Mail01Icon,
		StarIcon,
		Attachment01Icon,
		FilterHorizontalIcon,
		InboxUnreadIcon,
		Tick02Icon,
		Archive02Icon,
		MailReply02Icon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { stripHtml } from '$lib/utils/html';
	import { tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Virtualizer } from 'virtua/svelte';

	type ConversationView = {
		id: string;
		subject: string;
		snippet: string;
		preview: string;
		unread: boolean;
		starred: boolean;
		hasAttachment: boolean;
		participants: { id: number; name: string; avatarUrl: string | null }[];
		participantNames: string;
		contextName: string | null;
		contextCode: string | null;
		lastMessageAt: string | null;
		time: string;
		timestamp: string;
		messageCount: number;
	};

	let query = $state('');
	let selectedCourse = $state('all');
	let onlyUnread = $state(false);
	let onlyStarred = $state(false);
	let onlyAttachment = $state(false);

	let expanded = new SvelteSet<string>();
	let convs = $state<ConversationView[] | null>(null);
	let loadError = $state<string | null>(null);
	let loading = $state(true);
	let scrollEl: HTMLDivElement | undefined = $state(undefined);

	let drafts = $state<Record<string, string>>({});
	let sendError = $state<Record<string, string>>({});
	let sendingSet = new SvelteSet<string>();
	let sendSuccess = new SvelteSet<string>();
	let replyActive = new SvelteSet<string>();

	let sweepActive = $state(false);
	let sweepIndex = $state(0);
	let sweepBulkPending = $state(false);

	let filtersOpen = $state(false);
	let triageOpen = $state(false);
	let filtersPopoverEl: HTMLDivElement | undefined = $state(undefined);
	let triagePopoverEl: HTMLDivElement | undefined = $state(undefined);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let virt: any = $state(undefined);

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
			starred: raw.starred ?? false,
			hasAttachment: (raw as { hasAttachment?: boolean }).hasAttachment ?? false,
			participants: raw.participants,
			participantNames: raw.participants.map((p) => p.name).join(', ') || 'Unknown',
			contextName: raw.contextName,
			contextCode: raw.contextCode,
			lastMessageAt: raw.lastMessageAt,
			time: formatRelative(raw.lastMessageAt),
			timestamp: formatFull(raw.lastMessageAt),
			messageCount: raw.messageCount ?? 1
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
				const requestedConversation = page.url.searchParams.get('conversation');
				if (
					requestedConversation &&
					mapped.some((conversation) => conversation.id === requestedConversation)
				) {
					expanded.add(requestedConversation);
				}
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

	$effect(() => {
		function handleMouseDown(e: MouseEvent) {
			const target = e.target as Node;
			if (filtersOpen && filtersPopoverEl) {
				const trigger = document.getElementById('filters-trigger');
				if (!filtersPopoverEl.contains(target) && !trigger?.contains(target)) {
					filtersOpen = false;
				}
			}
			if (triageOpen && triagePopoverEl) {
				const trigger = document.getElementById('triage-trigger');
				if (!triagePopoverEl.contains(target) && !trigger?.contains(target)) {
					triageOpen = false;
				}
			}
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				filtersOpen = false;
				triageOpen = false;
			}
		}
		document.addEventListener('mousedown', handleMouseDown);
		document.addEventListener('keydown', handleKey);
		return () => {
			document.removeEventListener('mousedown', handleMouseDown);
			document.removeEventListener('keydown', handleKey);
		};
	});

	function toggle(id: string) {
		if (expanded.has(id)) {
			expanded.delete(id);
			replyActive.delete(id);
		} else expanded.add(id);
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

	let courseOptions = $derived.by(() => {
		if (!convs) return [] as { name: string; count: number }[];
		const counts: Record<string, number> = {};
		for (const c of convs) {
			if (c.contextName) counts[c.contextName] = (counts[c.contextName] ?? 0) + 1;
		}
		return Object.entries(counts)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	let hasActiveFilters = $derived(
		selectedCourse !== 'all' || onlyUnread || onlyStarred || onlyAttachment || query.trim() !== ''
	);

	let activeFilterCount = $derived(
		(selectedCourse !== 'all' ? 1 : 0) +
			(onlyUnread ? 1 : 0) +
			(onlyStarred ? 1 : 0) +
			(onlyAttachment ? 1 : 0)
	);

	let filtered = $derived.by(() => {
		if (!convs) return [];
		let list = convs;
		if (selectedCourse !== 'all') list = list.filter((c) => c.contextName === selectedCourse);
		if (onlyUnread) list = list.filter((c) => c.unread);
		if (onlyStarred) list = list.filter((c) => c.starred);
		if (onlyAttachment) list = list.filter((c) => c.hasAttachment);
		const q = query.trim();
		if (!q) return list;
		return list
			.map((m) => ({ m, s: messageScore(q, m) }))
			.filter((x) => x.s >= 0)
			.sort((a, b) => b.s - a.s)
			.map((x) => x.m);
	});

	let filteredUnread = $derived(filtered.filter((c) => c.unread));
	let sweepList = $derived(filteredUnread);
	let sweepCurrent = $derived(sweepList[sweepIndex] ?? null);
	let triageDisabled = $derived(loading || !convs || filteredUnread.length === 0);

	function scrollToConversation(id: string) {
		if (!virt || !filtered.length) return;
		const idx = filtered.findIndex((c) => c.id === id);
		if (idx < 0) return;
		tick().then(() => virt!.scrollToIndex(idx, { align: 'start', smooth: true }));
	}

	let _prevSweepId: string | null = $state(null);

	$effect(() => {
		if (!sweepActive) {
			_prevSweepId = null;
			return;
		}
		const cur = sweepCurrent;
		if (!cur) {
			sweepActive = false;
			return;
		}
		untrack(() => {
			if (_prevSweepId && _prevSweepId !== cur.id) {
				expanded.delete(_prevSweepId);
				replyActive.delete(_prevSweepId);
			}
			if (!expanded.has(cur.id)) expanded.add(cur.id);
			_prevSweepId = cur.id;
			scrollToConversation(cur.id);
		});
	});

	$effect(() => {
		if (triageDisabled) {
			if (triageOpen) triageOpen = false;
			if (sweepActive) sweepActive = false;
		}
	});

	function clearFilters() {
		selectedCourse = 'all';
		onlyUnread = false;
		onlyStarred = false;
		onlyAttachment = false;
		query = '';
	}

	function startSweep() {
		if (triageDisabled) return;
		sweepIndex = 0;
		sweepActive = true;
		triageOpen = true;
		// expansion + scroll handled by sweep effect
		if (!sweepList[0]) {
			setTimeout(() => {
				if (scrollEl) scrollEl.scrollTop = 0;
			}, 50);
		}
	}

	function exitSweep() {
		sweepActive = false;
	}

	function nextSweep() {
		if (!sweepCurrent) {
			sweepActive = false;
			return;
		}
		if (sweepIndex < sweepList.length - 1) {
			sweepIndex += 1;
		} else {
			sweepActive = false;
		}
	}

	function prevSweep() {
		if (!sweepCurrent) return;
		if (sweepIndex > 0) sweepIndex -= 1;
	}

	async function handleSend(id: string) {
		const body = (drafts[id] ?? '').trim();
		if (!body || sendingSet.has(id)) return;
		sendingSet.add(id);
		sendError[id] = '';
		sendSuccess.delete(id);
		try {
			await replyToConversation({ conversationId: id, body });
			drafts[id] = '';
			sendSuccess.add(id);
			setTimeout(() => sendSuccess.delete(id), 2500);
		} catch (e) {
			sendError[id] = e instanceof Error ? e.message : 'Failed to send reply';
		} finally {
			sendingSet.delete(id);
		}
	}

	async function toggleStar(conv: ConversationView) {
		const next = !conv.starred;
		conv.starred = next;
		try {
			await updateConversation({ conversationId: conv.id, starred: next });
		} catch {
			conv.starred = !next;
		}
	}

	async function markAs(conv: ConversationView, workflowState: 'read' | 'unread' | 'archived') {
		const prev = conv.unread;
		if (workflowState === 'read') conv.unread = false;
		if (workflowState === 'unread') conv.unread = true;
		try {
			await updateConversation({ conversationId: conv.id, workflowState });
		} catch {
			conv.unread = prev;
		}
	}

	async function handleSweepMarkRead() {
		if (!sweepCurrent) return;
		const prevId = sweepCurrent.id;
		// capture next id before the list mutates (filteredUnread will shrink)
		const oldList = [...sweepList];
		const oldIdx = sweepIndex;
		const nextIdInOld = oldList[oldIdx + 1]?.id ?? null;
		// close previous immediately for instant feedback; effect will also clean up _prevSweepId
		untrack(() => {
			expanded.delete(prevId);
			replyActive.delete(prevId);
		});
		await markAs(sweepCurrent, 'read');
		if (!nextIdInOld) {
			sweepActive = false;
			return;
		}
		// sweepList may have recomputed; find where the next item landed
		let newIdx = sweepList.findIndex((c) => c.id === nextIdInOld);
		if (newIdx === -1) {
			// fallback: if the list switched (e.g. no more unread, fallback to filtered),
			// keep the same logical position
			newIdx = Math.min(oldIdx, sweepList.length - 1);
			if (newIdx < 0) {
				sweepActive = false;
				return;
			}
		}
		sweepIndex = newIdx;
		// expansion + scroll handled by sweep effect
	}

	async function handleSweepStar() {
		if (!sweepCurrent) return;
		await toggleStar(sweepCurrent);
	}

	async function markFilteredAsRead() {
		if (filteredUnread.length === 0 || sweepBulkPending) return;
		sweepBulkPending = true;
		const ids = filteredUnread.map((c) => c.id);
		try {
			await bulkUpdateConversations({ conversationIds: ids, workflowState: 'read' });
			for (const c of convs ?? []) if (ids.includes(c.id)) c.unread = false;
		} catch {
			// ignore
		} finally {
			sweepBulkPending = false;
		}
	}
</script>

<svelte:head>
	<title>Inbox | Gesso</title>
</svelte:head>

<main class="flex size-full flex-col overflow-hidden bg-background">
	<div bind:this={scrollEl} class="flex-1 overflow-y-auto">
		<div class="sticky top-0 z-10 px-4 py-4 xl:px-6 2xl:px-8">
			<div class="mx-auto w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
				<!-- Search bar with two popovers: filters and triage -->
				<div class="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						class="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-foreground/60"
					/>
					<Input
						bind:value={query}
						placeholder="Search"
						aria-label="Search inbox"
						class="h-9 rounded-full border border-border/40 bg-background/85 pr-20 pl-9 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-background/85"
						autocomplete="off"
						spellcheck="false"
						disabled={loading}
					/>
					<!-- Filters + Triage popover triggers inside search bar -->
					<div class="absolute top-1/2 right-1 z-10 flex -translate-y-1/2 items-center gap-1">
						<!-- Filters menu popover -->
						<div class="relative">
							<button
								id="filters-trigger"
								type="button"
								aria-label="Filters menu"
								aria-haspopup="dialog"
								aria-expanded={filtersOpen}
								onclick={() => {
									filtersOpen = !filtersOpen;
									if (filtersOpen) triageOpen = false;
								}}
								class="relative inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground {filtersOpen
									? 'bg-muted text-foreground'
									: ''}"
							>
								<HugeiconsIcon icon={FilterHorizontalIcon} class="size-4" />
								{#if activeFilterCount > 0}
									<span
										class="absolute -top-0.5 -right-0.5 inline-flex size-2.5 items-center justify-center rounded-full bg-primary ring-2 ring-background"
									></span>
								{/if}
							</button>
							{#if filtersOpen}
								<div
									bind:this={filtersPopoverEl}
									role="dialog"
									aria-label="Filters menu"
									class="absolute top-full right-0 z-50 mt-2 w-[22rem] origin-top-right rounded-xl border bg-popover p-3 shadow-xl"
								>
									<div class="mb-3 flex items-center justify-between">
										<h3 class="text-sm font-semibold">Filters</h3>
										{#if hasActiveFilters}
											<button
												type="button"
												onclick={clearFilters}
												class="text-xs font-medium text-primary hover:underline"
											>
												Clear filters
											</button>
										{/if}
									</div>

									<div class="space-y-3">
										<div class="space-y-1.5">
											<label for="course-filter" class="text-xs font-medium text-muted-foreground"
												>Filter by course</label
											>
											<select
												id="course-filter"
												aria-label="Filter by course"
												bind:value={selectedCourse}
												class="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
												disabled={loading || !convs}
											>
												<option value="all">All courses ({convs?.length ?? 0})</option>
												{#each courseOptions as opt (opt.name)}
													<option value={opt.name}>{opt.name} ({opt.count})</option>
												{/each}
											</select>
										</div>

										<Separator />

										<div class="grid grid-cols-1 gap-2">
											<button
												type="button"
												aria-pressed={onlyUnread}
												aria-label="Toggle unread only"
												onclick={() => (onlyUnread = !onlyUnread)}
												class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition-colors {onlyUnread
													? 'border-primary bg-primary/10'
													: 'border-border hover:bg-muted'}"
											>
												<span class="flex items-center gap-2">
													<HugeiconsIcon icon={InboxUnreadIcon} class="size-4" />
													Unread only
												</span>
												<span
													class="inline-flex size-4 items-center justify-center rounded-full border text-[10px] {onlyUnread
														? 'border-primary bg-primary text-primary-foreground'
														: 'border-muted-foreground/30'}"
												>
													{#if onlyUnread}
														<HugeiconsIcon icon={Tick02Icon} class="size-3" />
													{/if}
												</span>
											</button>

											<button
												type="button"
												aria-pressed={onlyStarred}
												aria-label="Toggle starred"
												onclick={() => (onlyStarred = !onlyStarred)}
												class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition-colors {onlyStarred
													? 'border-amber-500 bg-amber-500/10'
													: 'border-border hover:bg-muted'}"
											>
												<span class="flex items-center gap-2">
													<HugeiconsIcon
														icon={StarIcon}
														class="size-4 {onlyStarred
															? 'text-amber-500 [&_path]:fill-current'
															: ''}"
													/>
													Starred
												</span>
												<span
													class="inline-flex size-4 items-center justify-center rounded-full border text-[10px] {onlyStarred
														? 'border-amber-500 bg-amber-500 text-white'
														: 'border-muted-foreground/30'}"
												>
													{#if onlyStarred}
														<HugeiconsIcon icon={Tick02Icon} class="size-3" />
													{/if}
												</span>
											</button>

											<button
												type="button"
												aria-pressed={onlyAttachment}
												aria-label="Toggle has attachment"
												onclick={() => (onlyAttachment = !onlyAttachment)}
												class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition-colors {onlyAttachment
													? 'border-primary bg-primary/10'
													: 'border-border hover:bg-muted'}"
											>
												<span class="flex items-center gap-2">
													<HugeiconsIcon icon={Attachment01Icon} class="size-4" />
													Has attachment
												</span>
												<span
													class="inline-flex size-4 items-center justify-center rounded-full border text-[10px] {onlyAttachment
														? 'border-primary bg-primary text-primary-foreground'
														: 'border-muted-foreground/30'}"
												>
													{#if onlyAttachment}
														<HugeiconsIcon icon={Tick02Icon} class="size-3" />
													{/if}
												</span>
											</button>
										</div>
									</div>
								</div>
							{/if}
						</div>

						<!-- Triage popover -->
						<div class="relative">
							<button
								id="triage-trigger"
								type="button"
								aria-label="Triage sweep"
								aria-haspopup="dialog"
								aria-expanded={triageOpen}
								disabled={triageDisabled}
								onclick={() => {
									if (triageDisabled) return;
									triageOpen = !triageOpen;
									if (triageOpen) filtersOpen = false;
								}}
								class="relative inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 {triageOpen ||
								sweepActive
									? 'bg-muted text-foreground'
									: ''}"
							>
								<HugeiconsIcon icon={InboxUnreadIcon} class="size-4" />
								{#if filteredUnread.length > 0}
									<span
										class="absolute -top-0.5 -right-0.5 inline-flex size-2.5 items-center justify-center rounded-full bg-primary ring-2 ring-background"
									></span>
								{/if}
							</button>
							{#if triageOpen}
								<div
									bind:this={triagePopoverEl}
									role="dialog"
									aria-label="Triage sweep"
									class="absolute top-full right-0 z-50 mt-2 w-[24rem] origin-top-right rounded-xl border bg-popover p-3 shadow-xl"
								>
									<div class="mb-3 flex items-center justify-between">
										<h3 class="text-sm font-semibold">Triage sweep</h3>
										<span class="text-xs text-muted-foreground">
											{filteredUnread.length} unread · {filtered.length} filtered
										</span>
									</div>

									{#if !sweepActive}
										<div class="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs">
											<p class="font-medium">Sweep your inbox fast</p>
											<p class="text-muted-foreground">
												Step through conversations matching your current filters.
											</p>
										</div>
										<div class="mt-3 flex items-center gap-2">
											<Button
												variant="outline"
												size="xs"
												class="flex-1"
												disabled={filteredUnread.length === 0 || sweepBulkPending}
												onclick={markFilteredAsRead}
											>
												{#if sweepBulkPending}
													<Spinner class="size-3" />
												{:else}
													<HugeiconsIcon icon={Tick02Icon} class="size-3.5" />
												{/if}
												Mark filtered as read
											</Button>
											<Button
												variant="default"
												size="xs"
												class="flex-1"
												disabled={sweepList.length === 0}
												onclick={startSweep}
											>
												Sweep triage ({sweepList.length})
											</Button>
										</div>
										{#if sweepList.length === 0}
											<p class="mt-2 text-center text-xs text-muted-foreground">
												No conversations to triage.
											</p>
										{/if}
									{:else}
										<div class="rounded-lg border bg-card px-3 py-2">
											<div class="text-xs font-medium">
												Triage {sweepIndex + 1} / {sweepList.length}
											</div>
											{#if sweepCurrent}
												<div class="mt-1 truncate text-xs text-muted-foreground">
													{sweepCurrent.subject} — {sweepCurrent.participantNames}
												</div>
											{/if}
											<div class="mt-3 grid grid-cols-2 gap-2">
												<Button variant="outline" size="xs" onclick={handleSweepStar}>
													<HugeiconsIcon
														icon={StarIcon}
														class="size-3.5 {sweepCurrent?.starred
															? 'text-amber-500 [&_path]:fill-current'
															: ''}"
													/>
													{sweepCurrent?.starred ? 'Starred' : 'Star'}
												</Button>
												<Button variant="default" size="xs" onclick={handleSweepMarkRead}>
													<HugeiconsIcon icon={Tick02Icon} class="size-3.5" />
													Mark read & next
												</Button>
												<Button
													variant="ghost"
													size="xs"
													onclick={prevSweep}
													disabled={sweepIndex === 0}>Prev</Button
												>
												<Button variant="ghost" size="xs" onclick={nextSweep}>Skip</Button>
											</div>
											<Separator class="my-2" />
											<div class="flex items-center justify-between">
												<span class="text-xs text-muted-foreground">
													{filtered.length} filtered
												</span>
												<Button variant="ghost" size="xs" onclick={exitSweep}>Exit sweep</Button>
											</div>
										</div>
									{/if}
								</div>
							{/if}
						</div>

						{#if query}
							<button
								type="button"
								aria-label="Clear search"
								onclick={() => (query = '')}
								class="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
							>
								<HugeiconsIcon icon={Cancel01Icon} class="size-4" />
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div
			class="mx-auto w-full max-w-3xl px-4 pt-2 pb-6 lg:max-w-4xl xl:max-w-5xl xl:px-6 2xl:max-w-6xl 2xl:px-8"
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
					<p class="mt-1 text-sm text-muted-foreground">
						Try a different search term or adjust filters.
					</p>
					<button
						type="button"
						onclick={clearFilters}
						class="mt-3 text-sm font-medium text-chart-1 hover:underline"
					>
						Clear search and filters
					</button>
				</div>
			{:else}
				<div class="overflow-hidden rounded-xl border bg-card">
					<Virtualizer bind:this={virt} data={filtered} getKey={(c) => c.id} scrollRef={scrollEl}>
						{#snippet children(conv: ConversationView, idx: number)}
							{@const isExpanded = expanded.has(conv.id)}
							{@const isSweepCurrent = sweepActive && sweepCurrent?.id === conv.id}
							<Item.Root
								variant="default"
								class="group flex-col items-stretch gap-0 rounded-none border-0 px-0 py-0 text-left hover:bg-muted/40 focus-visible:bg-muted/40 {idx !==
								0
									? 'border-t border-border'
									: ''} {isExpanded ? 'bg-muted/20' : ''} {isSweepCurrent
									? 'ring-1 ring-primary ring-inset'
									: ''}"
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
											{#if conv.starred}
												<HugeiconsIcon
													icon={StarIcon}
													class="size-3.5 text-amber-500 [&_path]:fill-current"
												/>
											{/if}
											{#if conv.hasAttachment}
												<HugeiconsIcon
													icon={Attachment01Icon}
													class="size-3.5 text-muted-foreground"
												/>
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
											<div
												class="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground/60"
											>
												<span class="truncate">{conv.contextName}</span>
												{#if conv.messageCount > 1}
													<span class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px]"
														>{conv.messageCount} msgs</span
													>
												{/if}
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

											<div class="mt-4 flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon-xs"
													aria-label={conv.starred ? 'Unstar' : 'Star'}
													onclick={(e: MouseEvent) => {
														e.stopPropagation();
														toggleStar(conv);
													}}
													class="text-foreground"
												>
													<HugeiconsIcon
														icon={StarIcon}
														class="size-3.5 {conv.starred
															? 'text-amber-500 [&_path]:fill-current'
															: 'text-muted-foreground'}"
													/>
												</Button>
												{#if conv.unread}
													<Button
														variant="ghost"
														size="icon-xs"
														aria-label="Mark as read"
														onclick={(e: MouseEvent) => {
															e.stopPropagation();
															markAs(conv, 'read');
														}}
														class="text-foreground"
													>
														<HugeiconsIcon icon={Tick02Icon} class="size-3.5" />
													</Button>
												{:else}
													<Button
														variant="ghost"
														size="icon-xs"
														aria-label="Mark unread"
														onclick={(e: MouseEvent) => {
															e.stopPropagation();
															markAs(conv, 'unread');
														}}
														class="text-foreground"
													>
														<HugeiconsIcon icon={InboxUnreadIcon} class="size-3.5" />
													</Button>
												{/if}
												<Button
													variant="ghost"
													size="icon-xs"
													aria-label="Archive"
													onclick={(e: MouseEvent) => {
														e.stopPropagation();
														markAs(conv, 'archived');
													}}
													class="text-foreground"
												>
													<HugeiconsIcon icon={Archive02Icon} class="size-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="icon-xs"
													aria-label="Reply"
													onclick={(e: MouseEvent) => {
														e.stopPropagation();
														if (replyActive.has(conv.id)) replyActive.delete(conv.id);
														else replyActive.add(conv.id);
													}}
													class="text-foreground"
												>
													<HugeiconsIcon icon={MailReply02Icon} class="size-3.5" />
												</Button>
											</div>

											{#if replyActive.has(conv.id)}
												<div
													class="mt-4 space-y-2"
													onclick={(e) => e.stopPropagation()}
													onkeydown={(e) => e.stopPropagation()}
													role="presentation"
												>
													<Textarea
														id="reply-{conv.id}"
														placeholder="Write a reply..."
														rows={3}
														bind:value={drafts[conv.id]}
														disabled={sendingSet.has(conv.id)}
														class="min-h-20 resize-none bg-background text-foreground"
													/>
													{#if sendError[conv.id]}
														<p class="text-xs text-destructive">{sendError[conv.id]}</p>
													{/if}
													{#if sendSuccess.has(conv.id)}
														<p class="text-xs text-foreground">Sent</p>
													{/if}
													<div class="flex justify-end gap-2">
														<Button
															variant="ghost"
															size="xs"
															disabled={!drafts[conv.id]?.trim() || sendingSet.has(conv.id)}
															onclick={() => (drafts[conv.id] = '')}
															class="text-foreground"
														>
															Clear
														</Button>
														<Button
															variant="default"
															size="xs"
															disabled={!drafts[conv.id]?.trim() || sendingSet.has(conv.id)}
															onclick={() => handleSend(conv.id)}
														>
															{#if sendingSet.has(conv.id)}
																<Spinner class="size-3" />
																Sending…
															{:else}
																Send reply
															{/if}
														</Button>
													</div>
												</div>
											{/if}
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
