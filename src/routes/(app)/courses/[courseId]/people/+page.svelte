<script lang="ts">
	import { page } from '$app/state';
	import { getCoursePeople } from '$lib/canvas';
	import { Input } from '$lib/components/ui/input';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Search01Icon, Cancel01Icon, UserGroupIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SvelteMap } from 'svelte/reactivity';

	let query = $state('');
	let people = $state<Awaited<ReturnType<typeof getCoursePeople>> | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	const courseId = $derived(page.params.courseId!);

	$effect(() => {
		const id = courseId;
		let cancelled = false;
		loading = true;
		loadError = null;
		people = null;
		getCoursePeople(id)
			.then((data) => {
				if (cancelled) return;
				people = data;
				loading = false;
			})
			.catch(() => {
				if (cancelled) return;
				loadError = 'Unable to load people.';
				loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	function initials(name: string) {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0])
			.join('')
			.toUpperCase();
	}

	const filtered = $derived.by(() => {
		if (!people) return [];
		const q = query.trim().toLowerCase();
		if (!q) return people;
		return people.filter((p) => `${p.name} ${p.role}`.toLowerCase().includes(q));
	});

	const grouped = $derived.by(() => {
		const groups = new SvelteMap<string, typeof filtered>();
		for (const p of filtered) {
			const role = p.role || 'Member';
			if (!groups.has(role)) groups.set(role, []);
			groups.get(role)!.push(p);
		}
		return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});
</script>

<svelte:head>
	<title>People | Gesso</title>
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
				placeholder="Search people"
				aria-label="Search people"
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
				<div class="space-y-2">
					<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
					{#each Array(6) as _, i (i)}
						<div class="flex items-center gap-3 rounded-xl border bg-card p-3">
							<div class="size-9 animate-pulse rounded-full bg-muted"></div>
							<div class="flex-1 space-y-2">
								<div class="h-4 w-32 animate-pulse rounded bg-muted"></div>
								<div class="h-3 w-20 animate-pulse rounded bg-muted/60"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if loadError}
				<div class="rounded-xl border px-6 py-12 text-center">
					<p class="text-sm font-medium">Couldn’t load people</p>
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
						<HugeiconsIcon icon={UserGroupIcon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">{query ? 'No matches' : 'No people'}</p>
					<p class="mt-1 text-sm text-muted-foreground">
						{query ? 'Try a different search term.' : 'No enrolled users found.'}
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
				<div class="space-y-6">
					{#each grouped as [role, members] (role)}
						<div>
							<p class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
								{role} · {members.length}
							</p>
							<div class="overflow-hidden rounded-xl border bg-card">
								{#each members as person, idx (person.id)}
									<div
										class="flex items-center gap-3 px-4 py-3 {idx !== 0
											? 'border-t border-border'
											: ''}"
									>
										<Avatar.Root class="size-8">
											<Avatar.Image src={person.avatarUrl ?? undefined} alt="" />
											<Avatar.Fallback class="text-xs">{initials(person.name)}</Avatar.Fallback>
										</Avatar.Root>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{person.name}</p>
											{#if person.pronouns}
												<p class="text-xs text-muted-foreground">{person.pronouns}</p>
											{/if}
										</div>
										<span
											class="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize"
										>
											{role.replace(/Enrollment$/, '').trim()}
										</span>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
