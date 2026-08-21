<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getCourseFiles } from '$lib/canvas';
	import { Input } from '$lib/components/ui/input';
	import { Search01Icon, Cancel01Icon, Folder01Icon, File02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	type CourseFiles = Awaited<ReturnType<typeof getCourseFiles>>;
	type CourseFolder = CourseFiles['folders'][number];
	type CourseFileItem = CourseFiles['files'][number];

	let query = $state(page.url.searchParams.get('q') ?? '');
	let data = $state<CourseFiles | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let scrollEl: HTMLDivElement | undefined = $state(undefined);

	const courseId = $derived(page.params.courseId!);
	const requestedFolderId = $derived.by(() => {
		const raw = page.params.folderId;
		if (!raw) return null;
		const parsed = Number(raw);
		return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
	});

	$effect(() => {
		const id = courseId;
		let cancelled = false;
		loading = true;
		loadError = null;
		data = null;
		getCourseFiles(id)
			.then((result) => {
				if (cancelled) return;
				data = result;
				loading = false;
			})
			.catch(() => {
				if (cancelled) return;
				loadError = 'Unable to load files.';
				loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	const filesRootHref = $derived(
		resolve('/(app)/courses/[courseId]/files/[[folderId]]', { courseId })
	);

	function folderHref(folderId: number) {
		return resolve('/(app)/courses/[courseId]/files/[[folderId]]', {
			courseId,
			folderId: String(folderId)
		});
	}

	function compareName(a: string, b: string) {
		return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
	}

	function formatDate(iso: string | null) {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		const units = ['KB', 'MB', 'GB'];
		let value = bytes / 1024;
		let unit = 0;
		while (value >= 1024 && unit < units.length - 1) {
			value /= 1024;
			unit += 1;
		}
		const digits = value >= 10 || unit === 0 ? 0 : 1;
		return `${value.toFixed(digits)} ${units[unit]}`;
	}

	function folderPath(folderId: number | null, folders: CourseFolder[]) {
		const names: string[] = [];
		let current = folderId;
		const seen: number[] = [];
		while (current != null && !seen.includes(current)) {
			seen.push(current);
			const folder = folders.find((item) => item.id === current);
			if (!folder) break;
			if (folder.parentId != null) names.unshift(folder.name);
			current = folder.parentId;
		}
		return names.join(' / ');
	}

	const rootFolder = $derived(data?.folders.find((folder) => folder.parentId == null) ?? null);
	const currentFolderId = $derived.by(() => {
		if (requestedFolderId == null) return rootFolder?.id ?? null;
		if (rootFolder && requestedFolderId === rootFolder.id) return rootFolder.id;
		return requestedFolderId;
	});
	const folderMissing = $derived(
		!loading &&
			data != null &&
			requestedFolderId != null &&
			!data.folders.some((folder) => folder.id === requestedFolderId)
	);

	const crumbs = $derived.by(() => {
		if (!data || currentFolderId == null) return [] as CourseFolder[];
		const trail: CourseFolder[] = [];
		let id: number | null = currentFolderId;
		const seen: number[] = [];
		while (id != null && !seen.includes(id)) {
			seen.push(id);
			const folder = data.folders.find((item) => item.id === id);
			if (!folder) break;
			if (folder.parentId == null) break;
			trail.unshift(folder);
			id = folder.parentId;
		}
		return trail;
	});

	const listedFolders = $derived.by(() => {
		if (!data) return [] as CourseFolder[];
		const q = query.trim().toLowerCase();
		let folders = data.folders.filter((folder) => folder.parentId != null);
		if (q) {
			folders = folders.filter((folder) => folder.name.toLowerCase().includes(q));
		} else if (currentFolderId != null) {
			folders = folders.filter((folder) => folder.parentId === currentFolderId);
		} else {
			folders = [];
		}
		return [...folders].sort((a, b) => compareName(a.name, b.name));
	});

	const listedFiles = $derived.by(() => {
		if (!data) return [] as CourseFileItem[];
		const q = query.trim().toLowerCase();
		let files = data.files;
		if (q) {
			files = files.filter((file) => file.name.toLowerCase().includes(q));
		} else if (currentFolderId != null) {
			files = files.filter((file) => file.folderId === currentFolderId);
		} else {
			files = [];
		}
		return [...files].sort((a, b) => compareName(a.name, b.name));
	});

	function childCount(folder: CourseFolder) {
		if (!data) return 0;
		const folders = data.folders.filter((item) => item.parentId === folder.id).length;
		const files = data.files.filter((item) => item.folderId === folder.id).length;
		return folders + files;
	}

	function itemLabel(count: number) {
		return count === 1 ? '1 item' : `${count} items`;
	}

	function fileMeta(file: CourseFileItem) {
		const parts = [formatSize(file.size)];
		const updated = formatDate(file.updatedAt);
		if (updated) parts.push(updated);
		if (file.locked) parts.push('Locked');
		return parts.join(' · ');
	}
</script>

<svelte:head>
	<title>Files | Gesso</title>
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
						aria-label="Search files"
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
					<p class="text-sm font-medium">Couldn’t load files</p>
					<p class="mt-1 text-sm text-muted-foreground">{loadError}</p>
					<button
						type="button"
						onclick={() => location.reload()}
						class="mt-4 text-sm font-medium text-chart-1 hover:underline"
					>
						Try again
					</button>
				</div>
			{:else if folderMissing}
				<div class="rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={Folder01Icon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">Folder not found</p>
					<p class="mt-1 text-sm text-muted-foreground">It may have been moved or deleted.</p>
					<a
						href={filesRootHref}
						class="mt-3 inline-block text-sm font-medium text-chart-1 hover:underline"
					>
						Back to files
					</a>
				</div>
			{:else}
				{#if crumbs.length > 0 && !query}
					<nav
						class="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs"
						aria-label="Folder"
					>
						<a href={filesRootHref} class="font-medium text-muted-foreground hover:text-foreground">
							Files
						</a>
						{#each crumbs as crumb, i (crumb.id)}
							<span class="text-muted-foreground/50">/</span>
							{#if i === crumbs.length - 1}
								<span class="font-medium text-foreground">{crumb.name}</span>
							{:else}
								<a
									href={folderHref(crumb.id)}
									class="font-medium text-muted-foreground hover:text-foreground"
								>
									{crumb.name}
								</a>
							{/if}
						{/each}
					</nav>
				{/if}
				{#if listedFolders.length === 0 && listedFiles.length === 0}
					<div class="rounded-xl border border-dashed px-6 py-16 text-center">
						<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
							<HugeiconsIcon icon={File02Icon} class="size-5 text-muted-foreground" />
						</div>
						<p class="mt-3 text-sm font-medium">{query ? 'No matches' : 'No files'}</p>
						<p class="mt-1 text-sm text-muted-foreground">
							{query
								? 'Try a different search term.'
								: crumbs.length > 0
									? 'This folder is empty.'
									: 'This course has no files.'}
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
						{#each listedFolders as folder, idx (folder.id)}
							<a
								href={folderHref(folder.id)}
								class="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 {idx !== 0
									? 'border-t border-border'
									: ''}"
							>
								<span
									class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
								>
									<HugeiconsIcon icon={Folder01Icon} class="size-4" />
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-medium">{folder.name}</span>
									<span class="block text-xs text-muted-foreground">
										{#if query && data}
											{folderPath(folder.parentId, data.folders) || 'Files'}
										{:else}
											{itemLabel(childCount(folder))}
										{/if}
									</span>
								</span>
							</a>
						{/each}
						{#each listedFiles as file, idx (file.id)}
							{@const rowClass = `flex items-center gap-3 px-4 py-3.5 ${
								idx !== 0 || listedFolders.length > 0 ? 'border-t border-border' : ''
							}`}
							{#if file.url}
								<a
									href={file.url}
									target="_blank"
									rel="external noreferrer"
									class="{rowClass} hover:bg-muted/40"
								>
									<span
										class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
									>
										<HugeiconsIcon icon={File02Icon} class="size-4" />
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-medium">{file.name}</span>
										<span class="block text-xs text-muted-foreground">
											{#if query && data}
												{[folderPath(file.folderId, data.folders) || 'Files', fileMeta(file)]
													.filter(Boolean)
													.join(' · ')}
											{:else}
												{fileMeta(file)}
											{/if}
										</span>
									</span>
								</a>
							{:else}
								<div class="{rowClass} opacity-70">
									<span
										class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
									>
										<HugeiconsIcon icon={File02Icon} class="size-4" />
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-medium">{file.name}</span>
										<span class="block text-xs text-muted-foreground">
											{#if query && data}
												{[folderPath(file.folderId, data.folders) || 'Files', fileMeta(file)]
													.filter(Boolean)
													.join(' · ')}
											{:else}
												{fileMeta(file)}
											{/if}
										</span>
									</span>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</main>
