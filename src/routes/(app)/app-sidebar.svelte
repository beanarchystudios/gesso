<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getCanvasUser, getCourseTabs, getFavoriteCourses } from '$lib/canvas';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import {
		Calendar03Icon,
		DashboardSquare02Icon,
		Mailbox01Icon,
		PaintBoardIcon,
		Task01Icon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	const user = getCanvasUser();
	const courseId = $derived(page.params.courseId);
	const courseTabs = $derived(courseId ? getCourseTabs(courseId) : null);
	const courseName = $derived(
		courseId
			? getFavoriteCourses().then(
					(courses) => courses.find((course) => course.id.toString() === courseId)?.name ?? 'Course'
				)
			: null
	);

	function initials(name: string) {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0])
			.join('')
			.toUpperCase();
	}

	const LOADING_TAB_ROWS = [1, 2, 3, 4, 5];

	const coursesPath = resolve('/(app)/courses');

	function isActive(pathname: string) {
		return (
			page.url.pathname === pathname ||
			(pathname !== coursesPath && page.url.pathname.startsWith(`${pathname}/`))
		);
	}

	const LINKS = [
		{ label: 'Dashboard', href: '/(app)/dashboard', icon: DashboardSquare02Icon },
		{ label: 'Courses', href: '/(app)/courses', icon: Task01Icon },
		{ label: 'Calendar', href: '/(app)/calendar', icon: Calendar03Icon },
		{ label: 'Inbox', href: '/(app)/inbox', icon: Mailbox01Icon }
	] as const;
</script>

<Sidebar.Root variant="inset">
	<Sidebar.Header>
		<Sidebar.MenuButton class="text-chart-1!">
			{#snippet child({ props })}
				<a {...props} href={resolve('/')}>
					<HugeiconsIcon icon={PaintBoardIcon} />
					Gesso
				</a>
			{/snippet}
		</Sidebar.MenuButton>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each LINKS as link (link.href)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={isActive(resolve(link.href))}>
								{#snippet child({ props })}
									<a
										{...props}
										href={resolve(link.href)}
										aria-current={isActive(resolve(link.href)) ? 'page' : undefined}
									>
										<HugeiconsIcon icon={link.icon} />
										{link.label}
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		{#if courseTabs}
			<Sidebar.Group>
				<Sidebar.GroupLabel>
					{#await courseName}
						<span class="h-3 w-24 animate-pulse rounded bg-sidebar-accent"></span>
					{:then name}
						<span class="truncate" title={name}>{name}</span>
					{/await}
				</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#await courseTabs}
							{#each LOADING_TAB_ROWS as row (row)}
								<Sidebar.MenuItem>
									<div
										class="h-8 w-full animate-pulse rounded-md bg-sidebar-accent"
										data-loading-row={row}
									></div>
								</Sidebar.MenuItem>
							{/each}
						{:then tabs}
							{#each tabs as tab (tab.id)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton isActive={tab.id === 'home'}>
										{#snippet child({ props })}
											<!-- eslint-disable svelte/no-navigation-without-resolve -->
											<a
												{...props}
												href={tab.id === 'home' ? page.url.pathname : tab.href}
												title={tab.label}
											>
												{tab.label}
											</a>
											<!-- eslint-enable svelte/no-navigation-without-resolve -->
										{/snippet}
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/each}
						{:catch}
							<p class="px-2 text-sm text-muted-foreground">Course navigation unavailable</p>
						{/await}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/if}
	</Sidebar.Content>

	<Sidebar.Footer>
		{#await user}
			<div class="flex h-10 items-center gap-2 px-2" aria-label="Loading Canvas user">
				<div class="size-8 shrink-0 animate-pulse rounded-full bg-sidebar-accent"></div>
				<div class="h-4 w-28 animate-pulse rounded-md bg-sidebar-accent"></div>
			</div>
		{:then user}
			<Sidebar.MenuButton size="lg" isActive={isActive(resolve('/(app)/account'))}>
				{#snippet child({ props })}
					<a
						{...props}
						href={resolve('/(app)/account')}
						aria-current={isActive(resolve('/(app)/account')) ? 'page' : undefined}
					>
						<Avatar.Root>
							<Avatar.Image
								src={user.avatarUrl ?? undefined}
								alt={`${user.name}'s profile picture`}
							/>
							<Avatar.Fallback>{initials(user.name)}</Avatar.Fallback>
						</Avatar.Root>
						<p title={user.name}>{user.name}</p>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		{:catch}
			<p class="truncate px-2 py-1 text-sm font-medium">Canvas user unavailable</p>
		{/await}
	</Sidebar.Footer>
</Sidebar.Root>
