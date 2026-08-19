<script lang="ts">
	import { resolve } from '$app/paths';
	import { getCanvasUser } from '$lib/canvas.remote';
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

	function initials(name: string) {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0])
			.join('')
			.toUpperCase();
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
		<Sidebar.MenuButton class="text-chart-2!">
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
							<Sidebar.MenuButton>
								{#snippet child({ props })}
									<a {...props} href={resolve(link.href)}>
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
	</Sidebar.Content>

	<Sidebar.Footer>
		{#await user}
			<div class="flex h-10 items-center gap-2 px-2" aria-label="Loading Canvas user">
				<div class="size-8 shrink-0 animate-pulse rounded-full bg-sidebar-accent"></div>
				<div class="h-4 w-28 animate-pulse rounded-md bg-sidebar-accent"></div>
			</div>
		{:then user}
			<Sidebar.MenuButton size="lg">
				{#snippet child({ props })}
					<a {...props} href={resolve('/(app)/account')}>
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
