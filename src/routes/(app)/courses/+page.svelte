<script lang="ts">
	import { resolve } from '$app/paths';
	import { getCourses } from '$lib/canvas';
	import * as Table from '$lib/components/ui/table';
	import { StarIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	const courses = getCourses();
	const loadingRows = [1, 2, 3, 4, 5];
</script>

<svelte:head>
	<title>Courses | Gesso</title>
</svelte:head>

<main class="size-full overflow-y-auto p-4 xl:p-6 2xl:p-8">
	<div class="mx-auto w-full max-w-7xl 2xl:max-w-[100rem]">
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
					{#each courses as course (course.id)}
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
								No active courses found.
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
</main>
