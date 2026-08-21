<script lang="ts">
	import { resolve } from '$app/paths';
	import { getCourses } from '$lib/canvas';
	import * as Command from '$lib/components/ui/command';
	import { getEnhancedSearchEnabled, subscribeEnhancedSearchEnabled } from '$lib/search-settings';
	import {
		clearSearchIndex,
		ensureSearchIndex,
		getIndexingStatus,
		searchDocuments,
		subscribeStatus,
		type SearchDocument
	} from '$lib/search';
	import { Spinner } from '$lib/components/ui/spinner';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let open = $state(false);
	let query = $state('');
	const courses = getCourses();
	let enhancedEnabled = $state(false);
	let indexingStatus = $state(getIndexingStatus());
	let searchResults = $state<{ document: SearchDocument; score: number }[]>([]);
	let searching = $state(false);
	let indexReady = $state(false);
	let searchError = $state<string | null>(null);

	function courseHref(courseId: number) {
		return resolve('/(app)/courses/[courseId]', { courseId: courseId.toString() });
	}

	const typeLabels = {
		course: { singular: 'Course', plural: 'Courses' },
		assignment: { singular: 'Assignment', plural: 'Assignments' },
		announcement: { singular: 'Announcement', plural: 'Announcements' },
		discussion: { singular: 'Discussion', plural: 'Discussions' },
		person: { singular: 'Person', plural: 'People' },
		module: { singular: 'Module', plural: 'Modules' },
		module_item: { singular: 'Module item', plural: 'Module items' },
		page: { singular: 'Page', plural: 'Pages' },
		file: { singular: 'File', plural: 'Files' },
		collaboration: { singular: 'Collaboration', plural: 'Collaborations' },
		conversation: { singular: 'Message', plural: 'Inbox' },
		calendar_event: { singular: 'Event', plural: 'Calendar' },
		grade: { singular: 'Grade', plural: 'Grades' },
		navigation: { singular: 'Link', plural: 'Navigation' }
	} satisfies Record<SearchDocument['type'], { singular: string; plural: string }>;

	function typeLabel(type: SearchDocument['type'], form: 'singular' | 'plural') {
		return typeLabels[type][form];
	}

	function groupOrder(type: SearchDocument['type']) {
		const order: Record<string, number> = {
			course: 0,
			navigation: 1,
			assignment: 2,
			calendar_event: 3,
			announcement: 4,
			discussion: 5,
			module: 6,
			module_item: 7,
			page: 8,
			file: 9,
			grade: 10,
			person: 11,
			conversation: 12,
			collaboration: 13
		};
		return order[type] ?? 99;
	}

	let groupedResults = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient map derived from searchResults
		const groups = new Map<string, { type: SearchDocument['type']; items: typeof searchResults }>();
		const primaryContentIds = new SvelteSet(
			searchResults
				.filter((hit) => hit.document.type !== 'module_item')
				.map((hit) => hit.document.canonicalId ?? hit.document.id)
		);
		const seenDocumentIds = new SvelteSet<string>();
		const seenModuleContentIds = new SvelteSet<string>();
		for (const hit of searchResults) {
			const document = hit.document;
			const canonicalId = document.canonicalId ?? document.id;

			if (seenDocumentIds.has(document.id)) continue;
			seenDocumentIds.add(document.id);

			if (document.type === 'module_item') {
				if (primaryContentIds.has(canonicalId) || seenModuleContentIds.has(canonicalId)) continue;
				seenModuleContentIds.add(canonicalId);
			}

			const t = document.type;
			if (!groups.has(t)) groups.set(t, { type: t, items: [] });
			groups.get(t)!.items.push(hit);
		}
		return [...groups.values()].sort((a, b) => groupOrder(a.type) - groupOrder(b.type));
	});

	async function loadSettings() {
		try {
			const enabled = await getEnhancedSearchEnabled();
			if (enabled !== enhancedEnabled) enhancedEnabled = enabled;
			if (enabled) {
				// trigger indexing in background if not already ready
				if (!indexReady && getIndexingStatus().status !== 'indexing') {
					ensureSearchIndex()
						.then(() => {
							indexReady = true;
							indexingStatus = getIndexingStatus();
						})
						.catch((e) => {
							searchError = e instanceof Error ? e.message : 'Indexing failed';
						});
				} else if (['ready', 'partial'].includes(getIndexingStatus().status)) {
					indexReady = true;
					indexingStatus = getIndexingStatus();
				}
			} else {
				indexReady = false;
				clearSearchIndex();
			}
		} catch {
			enhancedEnabled = false;
		}
	}

	onMount(() => {
		void loadSettings();
		const unsubSettings = subscribeEnhancedSearchEnabled(() => {
			void loadSettings();
		});
		const unsub = subscribeStatus(() => {
			const next = getIndexingStatus();
			// only assign if changed to avoid spurious effect re-runs
			if (
				next.status !== indexingStatus.status ||
				next.message !== indexingStatus.message ||
				next.count !== indexingStatus.count
			) {
				indexingStatus = next;
			}
			if (next.status === 'ready' || next.status === 'partial') indexReady = true;
		});

		function handleKeydown(event: KeyboardEvent) {
			const target = event.target as HTMLElement | null;
			const isTyping =
				target?.isContentEditable || target?.matches('input, textarea, select, [role="textbox"]');
			if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping) {
				event.preventDefault();
				open = true;
			}
			// also allow cmd+k / ctrl+k
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				open = true;
			}
		}
		window.addEventListener('keydown', handleKeydown);

		// Refresh settings after returning to the tab.
		function handleVisibility() {
			if (document.visibilityState === 'visible') void loadSettings();
		}
		document.addEventListener('visibilitychange', handleVisibility);
		window.addEventListener('focus', handleVisibility);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			document.removeEventListener('visibilitychange', handleVisibility);
			window.removeEventListener('focus', handleVisibility);
			unsubSettings();
			unsub();
		};
	});

	// Debounced search when enhanced enabled — stable, no polling, versioned to avoid races
	let searchVersion = 0;
	$effect(() => {
		const q = query.trim();
		const enabled = enhancedEnabled;
		const isOpen = open;

		if (!enabled || !isOpen) {
			searchVersion += 1;
			// don't clear when closed? keep results for next open but reset searching
			searching = false;
			if (!q) {
				searchResults = [];
				searchError = null;
			}
			return;
		}

		if (!q) {
			searchVersion += 1;
			searchResults = [];
			searching = false;
			searchError = null;
			return;
		}

		searching = true;
		searchError = null;
		const version = ++searchVersion;

		const timer = setTimeout(async () => {
			try {
				const hits = await searchDocuments(q, 40);
				if (version !== searchVersion) return;
				searchResults = hits;
			} catch (e) {
				if (version !== searchVersion) return;
				searchError = e instanceof Error ? e.message : 'Search failed';
				searchResults = [];
			} finally {
				if (version === searchVersion) searching = false;
			}
		}, 180);

		return () => {
			clearTimeout(timer);
			if (version === searchVersion) searchVersion += 1;
		};
	});

	$effect(() => {
		if (!open) query = '';
	});
</script>

<Command.Dialog
	bind:open
	shouldFilter={!enhancedEnabled}
	title="Search Gesso"
	description={enhancedEnabled ? 'Search supported Canvas content' : 'Search courses'}
	class="top-1/2! w-[min(42rem,calc(100vw-2rem))] -translate-y-1/2! rounded-2xl! border-border/60 shadow-2xl backdrop-blur-xl"
>
	<div class="border-b border-border/60">
		<Command.Input
			bind:value={query}
			class="h-11 text-base"
			placeholder="Search anything..."
			autofocus
		/>
	</div>
	<Command.List
		class="max-h-[min(55vh,26rem)] {enhancedEnabled &&
		!query.trim() &&
		!searching &&
		indexingStatus.status !== 'indexing' &&
		!searchError
			? 'p-0'
			: 'p-1'}"
	>
		{#if !searching && (query.trim() || (enhancedEnabled && (indexingStatus.status === 'indexing' || searchError)))}
			<Command.Empty class="py-6">
				{#if enhancedEnabled && indexingStatus.status === 'indexing'}
					Indexing your data… {indexingStatus.message}
				{:else if enhancedEnabled && searchError}
					{searchError}
				{:else if query.trim()}
					Nothing matches that search.
				{/if}
			</Command.Empty>
		{/if}

		{#if !enhancedEnabled}
			<Command.Group heading="Courses">
				{#await courses}
					<Command.Loading>Loading courses…</Command.Loading>
				{:then courseList}
					{#each courseList.filter((course) => course.name !== 'Untitled course') as course (course.id)}
						<Command.LinkItem
							href={courseHref(course.id)}
							value={`${course.name} ${course.code} ${course.term}`}
							onclick={() => (open = false)}
							class={course.previous ? 'text-muted-foreground' : undefined}
						>
							<span class="size-1 shrink-0 rounded-full" style={`background: ${course.color}`}
							></span>
							<span class="min-w-0 flex-1 truncate font-medium">{course.name}</span>
						</Command.LinkItem>
					{/each}
				{:catch}
					<p class="p-4 text-center text-sm text-muted-foreground">Courses are unavailable.</p>
				{/await}
			</Command.Group>
			<Command.Group heading="Settings">
				<Command.LinkItem
					href={resolve('/(app)/account')}
					value="Enable enhanced search"
					onclick={() => (open = false)}
				>
					<span class="min-w-0 flex-1 truncate text-sm"
						>Enable enhanced search in Account settings</span
					>
				</Command.LinkItem>
			</Command.Group>
		{:else}
			{#if indexingStatus.status === 'indexing' && !query.trim()}
				<div class="px-3 py-4 text-center text-sm text-muted-foreground">
					{indexingStatus.message || 'Building search index…'} — this may take a moment on first enable.
				</div>
			{:else if searching}
				<div class="flex items-center justify-center py-12">
					<Spinner />
				</div>
			{:else if query.trim() && groupedResults.length === 0 && !searching}
				<!-- empty handled by Command.Empty -->
			{:else if !query.trim()}
				<!-- intentionally empty — no hint -->
			{:else}
				{#each groupedResults as group (group.type)}
					<Command.Group heading={typeLabel(group.type, 'plural')}>
						{#each group.items as hit (hit.document.id)}
							<Command.LinkItem
								href={hit.document.href}
								value={`${hit.document.title} ${hit.document.description} ${hit.document.courseName} ${hit.document.meta}`}
								onclick={() => (open = false)}
							>
								<span class="min-w-0 flex-1 truncate">
									<span class="font-medium">{hit.document.title}</span>
									{#if hit.document.courseName}
										<span class="ml-2 truncate text-xs text-muted-foreground"
											>{hit.document.courseName}</span
										>
									{/if}
									{#if hit.document.meta}
										<span class="block truncate text-xs text-muted-foreground"
											>{hit.document.meta}</span
										>
									{/if}
								</span>
								<span
									class="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none tracking-wide text-muted-foreground uppercase"
									>{typeLabel(hit.document.type, 'singular')}</span
								>
							</Command.LinkItem>
						{/each}
					</Command.Group>
				{/each}
			{/if}
		{/if}
	</Command.List>
</Command.Dialog>
