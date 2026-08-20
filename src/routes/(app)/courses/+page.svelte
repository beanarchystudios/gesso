<script lang="ts">
	import { resolve } from '$app/paths';
	import { getCourses } from '$lib/canvas';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import { Cancel01Icon, Search01Icon, StarIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	const courses = getCourses();
	const loadingRows = [1, 2, 3, 4, 5];
	let query = $state('');
	let scrollEl: HTMLDivElement | undefined = $state(undefined);
</script>

<svelte:head>
	<title>Courses | Gesso</title>
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
						aria-label="Search courses"
						class="h-9 rounded-full border border-border/40 bg-background/85 pr-9 pl-9 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-background/85"
						autocomplete="off"
						spellcheck="false"
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
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-24">Favorite</Table.Head>
						<Table.Head>Course</Table.Head>
						<Table.Head>Term</Table.Head>
						<Table.Head>Enrolled</Table.Head>
						<Table.Head class="text-right">Status</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#await courses}
						{#each loadingRows as row (row)}
							<Table.Row aria-hidden="true">
								<Table.Cell><div class="size-4 animate-pulse rounded bg-muted"></div></Table.Cell>
								<Table.Cell><div class="h-4 w-48 animate-pulse rounded bg-muted"></div></Table.Cell>
								<Table.Cell><div class="h-4 w-28 animate-pulse rounded bg-muted"></div></Table.Cell>
								<Table.Cell><div class="h-4 w-12 animate-pulse rounded bg-muted"></div></Table.Cell>
								<Table.Cell
									><div class="ml-auto h-4 w-16 animate-pulse rounded bg-muted"></div></Table.Cell
								>
							</Table.Row>
						{/each}
					{:then courses}
						{@const q = query.trim().toLowerCase()}
						{@const filtered = q
							? courses.filter((course) =>
									`${course.name} ${course.term ?? ''} ${course.code ?? ''} ${course.status}`
										.toLowerCase()
										.includes(q)
								)
							: courses}
						{#each filtered as course (course.id)}
							<Table.Row class={course.previous ? 'text-muted-foreground' : undefined}>
								<Table.Cell>
									<HugeiconsIcon
										icon={StarIcon}
										class={course.favorite && !course.previous
											? 'size-4 [&_path]:fill-current'
											: 'size-4'}
										color={course.color}
									/>
								</Table.Cell>
								<Table.Cell class="font-medium">
									<a
										href={resolve('/(app)/courses/[courseId]', { courseId: course.id.toString() })}
										class="hover:underline">{course.name}</a
									>
								</Table.Cell>
								<Table.Cell class="text-muted-foreground">{course.term}</Table.Cell>
								<Table.Cell>{course.enrolled ? 'Yes' : 'No'}</Table.Cell>
								<Table.Cell class="text-right text-muted-foreground capitalize"
									>{course.status}</Table.Cell
								>
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell colspan={5} class="h-24 text-center text-muted-foreground">
									{#if q}
										<div class="flex flex-col items-center gap-2 py-2">
											<p>No matches</p>
											<p class="text-sm">Try a different search term.</p>
											<button
												type="button"
												onclick={() => (query = '')}
												class="text-sm font-medium text-primary hover:underline"
											>
												Clear search
											</button>
										</div>
									{:else}
										No active courses found.
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					{:catch}
						<Table.Row>
							<Table.Cell colspan={5} class="h-24 text-center text-destructive">
								Unable to load courses.
							</Table.Cell>
						</Table.Row>
					{/await}
				</Table.Body>
			</Table.Root>
		</div>
	</div>
</main>
