<script lang="ts">
	import { page } from '$app/state';
	import { getCourseChatLaunch } from '$lib/canvas';
	import { Spinner } from '$lib/components/ui/spinner';
	import { BubbleChatIcon, ExternalLinkIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	const courseId = $derived(page.params.courseId!);
	const chatLaunch = $derived(getCourseChatLaunch(courseId));
</script>

<svelte:head>
	{#await chatLaunch then launch}
		<title>{launch.name ?? 'Chat'} | Gesso</title>
	{/await}
</svelte:head>

<main class="flex size-full flex-col overflow-hidden bg-background">
	{#await chatLaunch}
		<div class="flex min-h-full items-center justify-center">
			<Spinner class="size-10 text-muted-foreground" />
		</div>
	{:then launch}
		{#if !launch.url}
			<div class="flex flex-1 items-center justify-center p-6">
				<div class="w-full max-w-md rounded-xl border border-dashed px-6 py-16 text-center">
					<div class="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
						<HugeiconsIcon icon={BubbleChatIcon} class="size-5 text-muted-foreground" />
					</div>
					<p class="mt-3 text-sm font-medium">Chat unavailable</p>
					<p class="mt-1 text-sm text-muted-foreground">
						This course does not have Chat enabled or the launch failed.
					</p>
				</div>
			</div>
		{:else}
			<div class="flex flex-1 items-center justify-center p-6">
				<div class="w-full max-w-md rounded-xl border bg-card px-6 py-12 text-center shadow-sm">
					<div class="mx-auto flex size-11 items-center justify-center rounded-full bg-chart-1/10">
						<HugeiconsIcon icon={BubbleChatIcon} class="size-5 text-chart-1" />
					</div>
					<h1 class="mt-4 text-base font-semibold">{launch.name}</h1>
					<p class="mt-1 text-sm text-muted-foreground">
						Canvas blocks Chat from being displayed inside Gesso. Open it in a new tab to continue.
					</p>
					<a
						href={launch.url}
						target="_blank"
						rel="external noreferrer"
						class="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					>
						Open Chat
						<HugeiconsIcon icon={ExternalLinkIcon} class="size-4" />
					</a>
				</div>
			</div>
		{/if}
	{:catch}
		<div class="flex flex-1 items-center justify-center p-6">
			<div class="w-full max-w-md rounded-xl border px-6 py-12 text-center">
				<p class="text-sm font-medium">Couldn’t load Chat</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Unable to load the Chat tool. Please try again.
				</p>
				<button
					type="button"
					onclick={() => location.reload()}
					class="mt-4 text-sm font-medium text-chart-1 hover:underline"
				>
					Try again
				</button>
			</div>
		</div>
	{/await}
</main>
