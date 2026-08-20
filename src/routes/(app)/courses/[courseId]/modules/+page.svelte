<script lang="ts">
	import { resolve } from '$app/paths';
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

	type RawModule = Awaited<ReturnType<typeof getCourseModules>>[number];
	type RawItem = RawModule['items'][number];

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

	function itemTarget(item: RawItem): { href: string; external: boolean } | null {
		const isAssignment = item.type.toLowerCase().includes('assign') && item.contentId != null;
		if (isAssignment) {
			return {
				href: resolve('/(app)/courses/[courseId]/assignments/[assignmentId]', {
					courseId,
					assignmentId: String(item.contentId)
				}),
				external: false
			};
		}
		if (item.htmlUrl) return { href: item.htmlUrl, external: true };
		return null;
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

	function itemTypeLabel(type: string) {
		const labels: Record<string, string> = {
			ExternalUrl: 'External link',
			ExternalTool: 'External tool',
			MediaObject: 'Media',
			WikiPage: 'Page'
		};
		return labels[type] ?? type.replace(/([a-z])([A-Z])/g, '$1 $2');
	}

	function itemMediaClasses(type: string) {
		const t = type.toLowerCase();
		// Distinct Tailwind tint per Canvas item type — subtle bg with colored icon/border, works in light + dark
		if (t === 'file' || t === 'attachment' || t.includes('file')) {
			return 'border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-400';
		}
		if (t === 'assignment' || t.includes('assign')) {
			return 'border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-400';
		}
		if (t === 'quiz' || t.includes('quiz')) {
			return 'border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:border-violet-400/20 dark:bg-violet-500/15 dark:text-violet-400';
		}
		if (t === 'page' || t === 'wikipage' || t.includes('page')) {
			return 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-400';
		}
		if (t === 'discussion' || t.includes('discussion')) {
			return 'border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-400';
		}
		if (t === 'externalurl' || t === 'externaltool' || t.includes('external')) {
			return 'border border-orange-500/20 bg-orange-500/10 text-orange-600 dark:border-orange-400/20 dark:bg-orange-500/15 dark:text-orange-400';
		}
		if (t === 'video' || t === 'mediaobject' || t.includes('media') || t.includes('video')) {
			return 'border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/15 dark:text-rose-400';
		}
		return 'border border-zinc-500/15 bg-zinc-500/10 text-zinc-600 dark:border-zinc-400/15 dark:bg-zinc-500/15 dark:text-zinc-400';
	}

	function formatDue(iso: string | null) {
		if (!iso) return null;
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return null;
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

	// Auto-expand modules when searching so matches are visible
	$effect(() => {
		const q = query.trim();
		if (!q) return;
		for (const m of filteredModules) expanded.add(m.id);
	});
</script>

<svelte:head>
	<title>Modules | Gesso</title>
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

		<div
			class="mx-auto w-full max-w-3xl px-4 pt-2 pb-6 lg:max-w-4xl xl:max-w-5xl xl:px-6 2xl:max-w-6xl 2xl:px-8"
		>
			{#if loading}
				<div class="space-y-4" aria-hidden="true" aria-label="Loading modules">
					<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
					{#each Array(3) as _, i (i)}
						<div class="overflow-hidden rounded-xl border bg-card">
							<div class="flex items-center gap-3 bg-muted/40 px-4 py-3">
								<div class="size-8 shrink-0 animate-pulse rounded-lg bg-background"></div>
								<div class="min-w-0 flex-1 space-y-2">
									<div class="h-4 w-2/3 animate-pulse rounded bg-muted"></div>
									<div class="h-3 w-20 animate-pulse rounded bg-muted/60"></div>
								</div>
								<div class="size-4 shrink-0 animate-pulse rounded bg-muted/40"></div>
							</div>
							<div class="divide-y divide-border border-t bg-card">
								<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
								{#each Array(3) as _, j (j)}
									<div class="flex items-center gap-3 px-4 py-3">
										<div class="size-8 shrink-0 animate-pulse rounded-lg bg-muted/60"></div>
										<div class="flex-1 space-y-1.5">
											<div class="h-3 w-3/4 animate-pulse rounded bg-muted"></div>
											<div class="h-2.5 w-24 animate-pulse rounded bg-muted/40"></div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else if loadError}
				<div class="rounded-xl border px-6 py-12 text-center">
					<p class="text-sm font-normal">Couldn’t load modules</p>
					<p class="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{loadError}</p>
					<button
						type="button"
						onclick={() => location.reload()}
						class="mt-4 text-sm font-normal text-chart-1 hover:underline"
					>
						Try again
					</button>
				</div>
			{:else if !modules || modules.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={Folder01Icon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-normal">No modules</p>
					<p class="mt-1 text-sm text-muted-foreground">This course has no published modules.</p>
				</div>
			{:else if filteredModules.length === 0}
				<div class="rounded-xl border border-dashed px-6 py-12 text-center">
					<p class="text-sm font-normal">No matches</p>
					<p class="mt-1 text-sm text-muted-foreground">Try a different search term.</p>
					<button
						type="button"
						onclick={() => (query = '')}
						class="mt-3 text-sm font-normal text-chart-1 hover:underline"
					>
						Clear search
					</button>
				</div>
			{:else}
				<div class="space-y-4">
					{#each filteredModules as mod (mod.id)}
						{@const isExpanded = expanded.has(mod.id)}
						<section class="overflow-hidden rounded-xl border bg-card shadow-sm">
							<button
								type="button"
								onclick={() => toggleModule(mod.id)}
								class="flex w-full cursor-pointer items-center gap-3 bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60"
								aria-expanded={isExpanded}
							>
								<span
									class="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground/70"
								>
									<HugeiconsIcon icon={Folder01Icon} class="size-3.5" />
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm leading-snug font-normal">{mod.name}</span>
									{#if mod.requireSequentialProgress || mod.prerequisiteModuleIds.length > 0}
										<span
											class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
										>
											{#if mod.requireSequentialProgress}
												<span>Sequential order</span>
											{/if}
											{#if mod.requireSequentialProgress && mod.prerequisiteModuleIds.length > 0}
												<span class="text-foreground/30 select-none" aria-hidden="true">·</span>
											{/if}
											{#if mod.prerequisiteModuleIds.length > 0}
												<span>Prerequisites</span>
											{/if}
										</span>
									{/if}
								</span>
								<HugeiconsIcon
									icon={ChevronDownIcon}
									class="size-4 shrink-0 text-foreground/40 transition-transform duration-150 {isExpanded
										? 'rotate-180'
										: 'rotate-0'}"
								/>
							</button>

							{#if isExpanded}
								<div class="divide-y divide-border border-t bg-card">
									{#if mod.items.length === 0}
										<p class="px-4 py-6 text-center text-sm text-muted-foreground">
											No items in this module.
										</p>
									{:else}
										<!-- eslint-disable svelte/no-navigation-without-resolve -->
										{#each mod.items as item (item.id)}
											{@const isSubHeader = item.type === 'SubHeader'}
											{@const target = itemTarget(item)}
											{#if isSubHeader}
												<div
													class="bg-muted/20 px-4 py-2.5"
													style:padding-left="{16 + Math.min(item.indent, 3) * 16}px"
												>
													<p
														class="text-xs font-normal tracking-widest text-foreground/60 uppercase"
													>
														{item.title}
													</p>
												</div>
											{:else if target?.external}
												<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
												<a
													href={target.href}
													target="_blank"
													rel="external noreferrer"
													class="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40"
													style:padding-left="{16 + Math.min(item.indent, 3) * 16}px"
												>
													<span
														class="flex size-8 shrink-0 items-center justify-center rounded-lg {itemMediaClasses(
															item.type
														)}"
													>
														<HugeiconsIcon icon={itemIcon(item.type)} class="size-4" />
													</span>
													<span class="min-w-0 flex-1">
														<span class="block truncate text-sm leading-snug font-normal"
															>{item.title}</span
														>
														<span
															class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
														>
															<span
																class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-normal"
																>{itemTypeLabel(item.type)}</span
															>
															{#if item.pointsPossible != null}
																<span class="text-foreground/30 select-none" aria-hidden="true"
																	>·</span
																>
																<span>{item.pointsPossible} pts</span>
															{/if}
															{#if formatDue(item.dueAt)}
																<span class="text-foreground/30 select-none" aria-hidden="true"
																	>·</span
																>
																<span>Due {formatDue(item.dueAt)}</span>
															{/if}
															{#if item.completionRequirement}
																<span class="text-foreground/30 select-none" aria-hidden="true"
																	>·</span
																>
																<span class="capitalize"
																	>{item.completionRequirement.type?.replace(/_/g, ' ')}</span
																>
															{/if}
														</span>
													</span>
													<HugeiconsIcon
														icon={ExternalLinkIcon}
														class="size-3.5 shrink-0 text-foreground/30 group-hover:text-foreground/60"
													/>
												</a>
											{:else if target}
												<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
												<a
													href={target.href}
													class="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40"
													style:padding-left="{16 + Math.min(item.indent, 3) * 16}px"
												>
													<span
														class="flex size-8 shrink-0 items-center justify-center rounded-lg {itemMediaClasses(
															item.type
														)}"
													>
														<HugeiconsIcon icon={itemIcon(item.type)} class="size-4" />
													</span>
													<span class="min-w-0 flex-1">
														<span class="block truncate text-sm leading-snug font-normal"
															>{item.title}</span
														>
														<span
															class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
														>
															<span
																class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-normal"
																>{itemTypeLabel(item.type)}</span
															>
															{#if item.pointsPossible != null}
																<span class="text-foreground/30 select-none" aria-hidden="true"
																	>·</span
																>
																<span>{item.pointsPossible} pts</span>
															{/if}
															{#if formatDue(item.dueAt)}
																<span class="text-foreground/30 select-none" aria-hidden="true"
																	>·</span
																>
																<span>Due {formatDue(item.dueAt)}</span>
															{/if}
															{#if item.completionRequirement}
																<span class="text-foreground/30 select-none" aria-hidden="true"
																	>·</span
																>
																<span class="capitalize"
																	>{item.completionRequirement.type?.replace(/_/g, ' ')}</span
																>
															{/if}
														</span>
													</span>
													<HugeiconsIcon
														icon={ChevronDownIcon}
														class="size-3.5 shrink-0 -rotate-90 text-foreground/30 group-hover:text-foreground/60"
													/>
												</a>
											{:else}
												<div
													class="flex items-center gap-3 px-4 py-3.5"
													style:padding-left="{16 + Math.min(item.indent, 3) * 16}px"
												>
													<span
														class="flex size-8 shrink-0 items-center justify-center rounded-lg {itemMediaClasses(
															item.type
														)}"
													>
														<HugeiconsIcon icon={itemIcon(item.type)} class="size-4" />
													</span>
													<span class="min-w-0 flex-1">
														<span class="block truncate text-sm leading-snug font-normal"
															>{item.title}</span
														>
														<span
															class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
														>
															<span
																class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-normal"
																>{itemTypeLabel(item.type)}</span
															>
															{#if item.pointsPossible != null}
																<span class="text-foreground/30 select-none" aria-hidden="true"
																	>·</span
																>
																<span>{item.pointsPossible} pts</span>
															{/if}
															{#if formatDue(item.dueAt)}
																<span class="text-foreground/30 select-none" aria-hidden="true"
																	>·</span
																>
																<span>Due {formatDue(item.dueAt)}</span>
															{/if}
															{#if item.lockedForUser}
																<span class="text-foreground/30 select-none" aria-hidden="true"
																	>·</span
																>
																<span>Locked</span>
															{/if}
														</span>
													</span>
												</div>
											{/if}
										{/each}
										<!-- eslint-enable svelte/no-navigation-without-resolve -->
									{/if}
								</div>
							{/if}
						</section>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
