<script lang="ts">
	import { resolve } from '$app/paths';
	import { getFavoriteCourses } from '$lib/canvas';
	import * as Card from '$lib/components/ui/card';

	const courses = getFavoriteCourses();
</script>

<svelte:head>
	<title>Dashboard | Gesso</title>
</svelte:head>

<main class="w-full overflow-y-auto p-4 xl:p-6 2xl:p-8">
	{#await courses}
		<div
			class="grid grid-cols-1 gap-4 min-[1920px]:grid-cols-6 min-[2560px]:grid-cols-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
			aria-label="Loading favorite courses"
		>
			{#each Array(3) as _ (_)}
				<div class="h-64 animate-pulse rounded-xl bg-muted"></div>
			{/each}
		</div>
	{:then courses}
		{#if courses.length > 0}
			<div
				class="grid grid-cols-1 gap-4 min-[1920px]:grid-cols-6 min-[2560px]:grid-cols-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
			>
				{#each courses as course (course.id)}
					<a href={resolve('/(app)/courses/[courseId]', { courseId: course.id.toString() })}>
						<Card.Root
							style={`--course-color: ${course.color ?? 'var(--primary)'}`}
							class="pt-0 ring-1 ring-(--course-color)/75"
						>
							<Card.Content class="px-0!">
								{#if course.imageUrl}
									<div
										class="relative w-full shrink-0 overflow-hidden"
										style="aspect-ratio: 262 / 146"
									>
										<img
											src={course.imageUrl}
											alt=""
											class="absolute inset-0 size-full object-cover"
										/>
										<div
											class="absolute inset-0 opacity-60"
											style="background-color: var(--course-color)"
										></div>
									</div>
								{:else}
									<div
										class="w-full bg-linear-to-b from-(--course-color)/25 to-primary/0"
										style="aspect-ratio: 262 / 146"
									></div>
								{/if}
							</Card.Content>
							<Card.Header>
								<Card.Title class="min-w-0">
									<span
										class="block truncate text-sm decoration-(--course-color) decoration-2 underline-offset-4 group-hover/card:underline"
										title={course.name}>{course.name}</span
									>
								</Card.Title>
							</Card.Header>
						</Card.Root>
					</a>
				{/each}
			</div>
		{:else}
			<p class="text-muted-foreground">You do not have any favorite courses.</p>
		{/if}
	{:catch}
		<p class="text-destructive">Unable to load favorite courses.</p>
	{/await}
</main>
