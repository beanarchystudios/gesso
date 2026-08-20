<script lang="ts">
	import { page } from '$app/state';
	import { getCourseModules } from '$lib/canvas';
	import { Input } from '$lib/components/ui/input';
	import {
		Search01Icon,
		Cancel01Icon,
		ChevronDownIcon,
		File02Icon,
		AssignmentsIcon,
		Quiz01Icon,
		Notebook01Icon,
		BubbleChatIcon,
		Attachment01Icon,
		ExternalLinkIcon,
		Video01Icon,
		Task01Icon,
		Folder01Icon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Virtualizer } from 'virtua/svelte';

	type RawModule = Awaited<ReturnType<typeof getCourseModules>>[number];

	type FlatRow =
		| {
				kind: 'module';
				key: string;
				moduleId: number;
				name: string;
		  }
		| {
				kind: 'item';
				key: string;
				moduleId: number;
				id: number;
				title: string;
				type: string;
				htmlUrl: string | null;
				indent: number;
		  };

	let query = $state('');
	let expanded = new SvelteSet<number>();
	let modules = $state<RawModule[] | null>(null);
	let loadError = $state<string | null>(null);
	let loading = $state(true);
	let scrollEl: HTMLDivElement | undefined = $state(undefined);

	const courseId = $derived(page.params.courseId!);

	$effect(() => {
		const id = courseId;
		let cancelled = false;
		loading = true;
		loadError = null;
		modules = null;
		getCourseModules(id)
			.then((mods) => {
				if (cancelled) return;
				modules = mods;
				for (const m of mods) expanded.add(m.id);
				loading = false;
			})
			.catch(() => {
				if (cancelled) return;
				loadError = 'Unable to load modules for this course.';
				loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	function toggleModule(id: number) {
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

	function itemIcon(type: string) {
		switch (type) {
			case 'File':
			case 'Attachment':
				return File02Icon;
			case 'Assignment':
				return AssignmentsIcon;
			case 'Quiz':
				return Quiz01Icon;
			case 'Page':
			case 'WikiPage':
				return Notebook01Icon;
			case 'Discussion':
				return BubbleChatIcon;
			case 'ExternalUrl':
			case 'ExternalTool':
				return ExternalLinkIcon;
			case 'SubHeader':
				return Folder01Icon;
			case 'Video':
			case 'MediaObject':
				return Video01Icon;
			default:
				if (type.toLowerCase().includes('quiz')) return Quiz01Icon;
				if (type.toLowerCase().includes('assign')) return Task01Icon;
				if (type.toLowerCase().includes('discussion')) return BubbleChatIcon;
				if (type.toLowerCase().includes('file')) return File02Icon;
				return Attachment01Icon;
		}
	}

	const filteredModules = $derived.by<RawModule[]>(() => {
		if (!modules) return [];
		const q = query.trim();
		if (!q) return modules;
		return modules
			.map((m) => {
				const moduleScore = fuzzyScore(q, m.name);
				const matchingItems = m.items.filter((it) => fuzzyScore(q, `${it.title} ${it.type}`) >= 0);
				const hasMatch = moduleScore >= 0 || matchingItems.length > 0;
				if (!hasMatch) return null;
				if (moduleScore >= 0) return m;
				return { ...m, items: matchingItems };
			})
			.filter((m): m is RawModule => m !== null);
	});

	const rows = $derived.by<FlatRow[]>(() => {
		const result: FlatRow[] = [];
		for (const m of filteredModules) {
			result.push({
				kind: 'module',
				key: `m-${m.id}`,
				moduleId: m.id,
				name: m.name
			});
			if (!expanded.has(m.id)) continue;
			for (const it of m.items) {
				result.push({
					kind: 'item',
					key: `i-${m.id}-${it.id}`,
					moduleId: m.id,
					id: it.id,
					title: it.title,
					type: it.type,
					htmlUrl: it.htmlUrl,
					indent: it.indent
				});
			}
		}
		return result;
	});
</script>

<svelte:head>
	<title>Modules | Gesso</title>
</svelte:head>

<main class="flex size-full flex-col overflow-hidden bg-background">
	<div bind:this={scrollEl} class="flex-1 overflow-y-auto">
		<div class="sticky top-0 z-10 px-4 py-4">
			<div class="mx-auto w-full max-w-3xl">
				<div class="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						class="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-foreground/60"
					/>
					<Input
						bind:value={query}
						placeholder="Search"
						aria-label="Search modules"
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

		<div class="mx-auto w-full max-w-3xl px-4 pt-2 pb-6">
			{#if loading}
				<div
					class="overflow-hidden rounded-xl border bg-card"
					aria-hidden="true"
					aria-label="Loading modules"
				>
					<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
					{#each Array(5) as _, i (i)}
						<div
							class="flex w-full items-center gap-3 px-4 py-3.5 {i !== 0
								? 'border-t border-border'
								: ''}"
						>
							<div class="size-8 shrink-0 animate-pulse rounded-full bg-muted"></div>
							<div class="min-w-0 flex-1 space-y-2">
								<div class="h-4 w-48 animate-pulse rounded bg-muted"></div>
								<div class="h-3 w-28 animate-pulse rounded bg-muted/60"></div>
							</div>
							<div class="size-4 shrink-0 animate-pulse rounded bg-muted/40"></div>
						</div>
					{/each}
				</div>
			{:else if loadError}
				<div class="rounded-xl border px-6 py-12 text-center">
					<p class="text-sm font-medium">Couldn’t load modules</p>
					<p class="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{loadError}</p>
					<button
						type="button"
						onclick={() => location.reload()}
						class="mt-4 text-sm font-medium text-primary hover:underline"
					>
						Try again
					</button>
				</div>
			{:else if !modules || modules.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={Folder01Icon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">No modules</p>
					<p class="mt-1 text-sm text-muted-foreground">This course has no published modules.</p>
				</div>
			{:else if rows.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-12 text-center">
					<p class="text-sm font-medium">No matches</p>
					<p class="mt-1 text-sm text-muted-foreground">Try a different search term.</p>
					<button
						type="button"
						onclick={() => (query = '')}
						class="mt-3 text-sm font-medium text-primary hover:underline"
					>
						Clear search
					</button>
				</div>
			{:else}
				<div class="overflow-hidden rounded-xl border bg-card">
					<Virtualizer data={rows} getKey={(r) => r.key} scrollRef={scrollEl}>
						{#snippet children(row: FlatRow, idx: number)}
							{#if row.kind === 'module'}
								{@const isExpanded = expanded.has(row.moduleId)}
								<button
									type="button"
									onclick={() => toggleModule(row.moduleId)}
									class="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 {idx !==
									0
										? 'border-t border-border'
										: ''} {isExpanded ? 'bg-muted/20' : ''}"
									aria-expanded={isExpanded}
								>
									<span
										class="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
									>
										<HugeiconsIcon icon={Folder01Icon} class="size-4" />
									</span>
									<span class="min-w-0 flex-1 truncate text-sm font-medium">
										{row.name}
									</span>
									<HugeiconsIcon
										icon={ChevronDownIcon}
										class="size-4 shrink-0 text-foreground/40 transition-transform duration-150 {isExpanded
											? 'rotate-180'
											: 'rotate-0'}"
									/>
								</button>
							{:else}
								{@const isSubHeader = row.type === 'SubHeader'}
								{#if isSubHeader}
									<div
										class="px-4 py-2.5 {idx !== 0 ? 'border-t border-border' : ''} bg-muted/10"
										style:padding-left="{16 + row.indent * 16}px"
									>
										<span
											class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
										>
											{row.title}
										</span>
									</div>
								{:else if row.htmlUrl}
									<a
										href={row.htmlUrl}
										target="_blank"
										rel="noreferrer"
										class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 {idx !==
										0
											? 'border-t border-border'
											: ''}"
										style:padding-left="{16 + row.indent * 16}px"
									>
										<HugeiconsIcon
											icon={itemIcon(row.type)}
											class="size-4 shrink-0 text-muted-foreground"
										/>
										<span class="min-w-0 flex-1 truncate text-sm">
											{row.title}
										</span>
										<HugeiconsIcon
											icon={ExternalLinkIcon}
											class="size-3.5 shrink-0 text-foreground/30"
										/>
									</a>
								{:else}
									<div
										class="flex w-full items-center gap-3 px-4 py-3 {idx !== 0
											? 'border-t border-border'
											: ''}"
										style:padding-left="{16 + row.indent * 16}px"
									>
										<HugeiconsIcon
											icon={itemIcon(row.type)}
											class="size-4 shrink-0 text-muted-foreground"
										/>
										<span class="min-w-0 flex-1 truncate text-sm">
											{row.title}
										</span>
									</div>
								{/if}
							{/if}
						{/snippet}
					</Virtualizer>
				</div>
			{/if}
		</div>
	</div>
</main>
