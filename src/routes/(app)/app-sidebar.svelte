<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import {
		Calendar03Icon,
		DashboardSquare02Icon,
		Mailbox01Icon,
		PaintBoardIcon,
		Task01Icon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

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
</Sidebar.Root>
