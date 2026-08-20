<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { clearCanvasCache, getCanvasUser, getCourseTabs, getFavoriteCourses } from '$lib/canvas';
	import { removeCanvasCredentials } from '$lib/canvas-credentials';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { getCourseTabShortcut } from '$lib/course-shortcuts';
	import {
		Calendar03Icon,
		DashboardSquare02Icon,
		Logout01Icon,
		Mailbox01Icon,
		PaintBoardIcon,
		Task01Icon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	const user = getCanvasUser();
	let signingOut = $state(false);
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

	async function signOut() {
		signingOut = true;
		try {
			await removeCanvasCredentials();
			await clearCanvasCache();
			await goto(resolve('/auth'), { replaceState: true });
		} finally {
			signingOut = false;
		}
	}

	const LOADING_TAB_ROWS = [1, 2, 3, 4, 5];

	const coursesPath = resolve('/(app)/courses');

	const activeCourseTabId = $derived.by(() => {
		if (!courseId) return null;
		const pathname = page.url.pathname;
		const base = resolve('/(app)/courses/[courseId]', { courseId: courseId! });
		if (pathname === base || pathname === `${base}/`) return 'home';
		if (pathname.startsWith(`${base}/`)) {
			const rest = pathname.slice(`${base}/`.length);
			const segment = rest.split('/')[0];
			return segment || 'home';
		}
		return null;
	});

	function isTabActive(tab: { id: string; label?: string }, active: string | null) {
		if (!active) return false;
		if (tab.id === active) return true;
		const label = (tab.label ?? '').toLowerCase();
		if (active === 'notebook' && label.includes('notebook')) return true;
		if (active === 'collaborations' && label.includes('collaborat')) return true;
		if (active === 'chat' && label.includes('chat')) return true;
		if (
			active === 'discussions' &&
			(tab.id === 'discussion_topics' || label.includes('discussion'))
		)
			return true;
		if (tab.id.startsWith('context_external_tool_') && label.includes(active.toLowerCase()))
			return true;
		return false;
	}

	function getTabHref(tab: { id: string; href: string; label?: string }) {
		if (!courseId) return tab.href;
		const label = (tab.label ?? '').toLowerCase();
		if (tab.id === 'home') return resolve('/(app)/courses/[courseId]', { courseId: courseId! });
		if (tab.id === 'modules')
			return resolve('/(app)/courses/[courseId]/modules', { courseId: courseId! });
		if (tab.id === 'announcements')
			return resolve('/(app)/courses/[courseId]/announcements', { courseId: courseId! });
		if (tab.id === 'assignments')
			return resolve('/(app)/courses/[courseId]/assignments', { courseId: courseId! });
		if (tab.id === 'discussion_topics' || tab.id === 'discussions')
			return resolve('/(app)/courses/[courseId]/discussions', { courseId: courseId! });
		if (tab.id === 'people' || tab.id === 'roster')
			return resolve('/(app)/courses/[courseId]/people', { courseId: courseId! });
		if (tab.id === 'collaborations' || label.includes('collaborat'))
			return resolve('/(app)/courses/[courseId]/collaborations', { courseId: courseId! });
		if (tab.id === 'pages' || tab.id === 'wiki' || label.includes('notebook'))
			return resolve('/(app)/courses/[courseId]/notebook', { courseId: courseId! });
		if (tab.id === 'syllabus')
			return resolve('/(app)/courses/[courseId]/syllabus', { courseId: courseId! });
		if (tab.id === 'grades')
			return resolve('/(app)/courses/[courseId]/grades', { courseId: courseId! });
		if (tab.id === 'chat' || label.includes('chat'))
			return resolve('/(app)/courses/[courseId]/chat', { courseId: courseId! });
		// external LTI that we map by label
		if (tab.id.startsWith('context_external_tool_')) {
			if (label.includes('notebook'))
				return resolve('/(app)/courses/[courseId]/notebook', { courseId: courseId! });
			if (label.includes('collaborat'))
				return resolve('/(app)/courses/[courseId]/collaborations', { courseId: courseId! });
			if (label.includes('chat'))
				return resolve('/(app)/courses/[courseId]/chat', { courseId: courseId! });
		}
		return tab.href;
	}

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
									<Sidebar.MenuButton isActive={isTabActive(tab, activeCourseTabId)}>
										{#snippet child({ props })}
											<!-- eslint-disable svelte/no-navigation-without-resolve -->
											<a
												{...props}
												href={getTabHref(tab)}
												title={tab.label}
												aria-keyshortcuts={getCourseTabShortcut(tab)}
											>
												<span class="truncate">{tab.label}</span>
												{#if getCourseTabShortcut(tab)}
													<kbd class="ml-auto font-sans text-xs text-sidebar-foreground/50">
														{getCourseTabShortcut(tab)}
													</kbd>
												{/if}
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
						<p title={user.name} class="text-base">{user.name}</p>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		{:catch}
			<div class="space-y-1">
				<a
					href={resolve('/(app)/account')}
					class="block truncate px-2 py-1 text-sm font-medium hover:underline"
				>
					Canvas user unavailable
				</a>
				<Sidebar.MenuButton onclick={signOut} aria-disabled={signingOut}>
					<HugeiconsIcon icon={Logout01Icon} />
					{signingOut ? 'Signing out…' : 'Sign out'}
				</Sidebar.MenuButton>
			</div>
		{/await}
	</Sidebar.Footer>
</Sidebar.Root>
