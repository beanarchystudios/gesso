<script lang="ts">
	import { clearCanvasCache, getCanvasUser } from '$lib/canvas';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		AlertCircleIcon,
		ExternalLinkIcon,
		Mail01Icon,
		RefreshIcon,
		Tick02Icon,
		UserIcon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	const user = getCanvasUser();

	let clearing = $state(false);
	let cleared = $state(false);
	let emailCopied = $state(false);
	let emailHovered = $state(false);

	function getScrambled(email: string | null): string {
		if (!email) return '—';
		const pool = 'abcdefghijklmnopqrstuvwxyz0123456789';
		let seed = 0;
		for (let i = 0; i < email.length; i += 1) seed = (seed * 31 + email.charCodeAt(i)) >>> 0;
		return email.replace(/[a-zA-Z0-9]/g, (character, offset) => {
			return pool[(seed + character.charCodeAt(0) + offset * 17) % pool.length];
		});
	}

	function initials(name: string) {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0])
			.join('')
			.toUpperCase();
	}

	async function copyEmail(email: string | null) {
		if (!email || email === '—') return;
		try {
			await navigator.clipboard.writeText(email);
			emailCopied = true;
			setTimeout(() => (emailCopied = false), 1500);
		} catch {
			// clipboard may be unavailable
		}
	}

	async function handleClearCache() {
		clearing = true;
		try {
			await clearCanvasCache();
			cleared = true;
			setTimeout(() => (cleared = false), 2500);
		} finally {
			clearing = false;
		}
	}
</script>

<svelte:head>
	<title>Account | Gesso</title>
</svelte:head>

<main class="size-full overflow-y-auto">
	<div class="mx-auto w-full max-w-3xl p-6 sm:p-8 lg:max-w-4xl xl:max-w-5xl xl:px-8 2xl:max-w-6xl">
		<header>
			<h1 class="text-2xl font-semibold tracking-tight">Account</h1>
		</header>

		<Separator class="my-6" />

		{#await user}
			<div class="mt-8 space-y-10" aria-label="Loading account">
				<div class="flex flex-col gap-6 sm:flex-row sm:items-start">
					<Skeleton class="size-24 shrink-0 rounded-full" />
					<div class="flex-1 space-y-3">
						<Skeleton class="h-7 w-48" />
						<Skeleton class="h-4 w-32" />
						<Skeleton class="h-4 w-full max-w-md" />
						<Skeleton class="h-4 w-3/4 max-w-sm" />
						<div class="flex gap-2 pt-2">
							<Skeleton class="h-8 w-32 rounded-lg" />
							<Skeleton class="h-8 w-28 rounded-lg" />
						</div>
					</div>
				</div>

				<div class="space-y-3">
					<Skeleton class="h-5 w-24" />
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-5/6" />
				</div>

				<div class="space-y-3">
					<Skeleton class="h-5 w-40" />
					<Skeleton class="h-4 w-full max-w-lg" />
					<Skeleton class="h-10 w-full max-w-xl rounded-lg" />
				</div>
			</div>
		{:then user}
			<!-- Profile -->
			<section class="mt-8">
				<div class="flex flex-col gap-6 sm:flex-row sm:items-start">
					<Avatar.Root class="size-24 shrink-0 border border-border text-xl shadow-sm">
						<Avatar.Image src={user.avatarUrl ?? undefined} alt="{user.name}'s avatar" />
						<Avatar.Fallback class="text-lg font-semibold">{initials(user.name)}</Avatar.Fallback>
					</Avatar.Root>

					<div class="min-w-0 flex-1 space-y-3">
						<div>
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-xl leading-none font-semibold tracking-tight" title={user.name}>
									{user.name}
								</h2>
								{#if user.pronouns}
									<span
										class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
									>
										{user.pronouns}
									</span>
								{/if}
							</div>
						</div>

						{#if user.title}
							<p class="text-sm font-medium text-foreground/90">{user.title}</p>
						{/if}

						{#if user.bio}
							<p class="max-w-prose text-sm leading-relaxed text-muted-foreground">
								{user.bio}
							</p>
						{:else}
							<p class="text-sm text-muted-foreground/70 italic">No bio set in Canvas.</p>
						{/if}

						<div class="flex flex-wrap gap-2 pt-1">
							<Button
								href={user.profileUrl}
								target="_blank"
								rel="noreferrer"
								size="sm"
								variant="default"
							>
								<HugeiconsIcon icon={ExternalLinkIcon} />
								Open in Canvas
							</Button>
						</div>
					</div>
				</div>
			</section>

			<!-- Contact -->
			<section class="mt-10 space-y-4">
				<div class="space-y-1">
					<h3 class="flex items-center gap-2 text-sm font-semibold">
						<span
							class="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground"
						>
							<HugeiconsIcon icon={Mail01Icon} class="size-4" />
						</span>
						Contact
					</h3>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between gap-4 py-1">
						<p class="text-sm">
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<span
								class="inline-block break-all transition-[filter] duration-200 {emailHovered
									? 'blur-none select-text'
									: 'blur-[6px] select-none'}"
								onmouseenter={() => (emailHovered = true)}
								onmouseleave={() => (emailHovered = false)}
							>
								{emailHovered ? (user.primaryEmail ?? '—') : getScrambled(user.primaryEmail)}
							</span>
						</p>
						<button
							onclick={() => copyEmail(user.primaryEmail)}
							class="-mr-1.5 shrink-0 rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
							disabled={!user.primaryEmail}
							aria-label={emailCopied ? 'Copied' : 'Copy email'}
							title={emailCopied ? 'Copied!' : 'Copy email'}
						>
							{#if emailCopied}
								<HugeiconsIcon
									icon={Tick02Icon}
									class="size-4 animate-in text-emerald-600 duration-200 zoom-in-50"
								/>
							{:else}
								<HugeiconsIcon icon={Mail01Icon} class="size-4" />
							{/if}
						</button>
					</div>
					<div class="flex items-center justify-between gap-4 py-1">
						<p class="text-sm break-all">
							{user.loginId ?? '—'}
						</p>
						<HugeiconsIcon icon={UserIcon} class="size-4 shrink-0 text-muted-foreground/40" />
					</div>
				</div>
			</section>

			<!-- Canvas connection -->
			<section class="mt-10">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="min-w-0 space-y-1">
						<p class="text-sm font-medium">Connected to Canvas</p>
						<p class="truncate text-xs text-muted-foreground" title={user.profileUrl}>
							{user.profileUrl}
						</p>
					</div>
					<div class="flex shrink-0 flex-wrap gap-2">
						<Button
							href={user.profileUrl}
							target="_blank"
							rel="noreferrer"
							variant="outline"
							size="sm"
						>
							<HugeiconsIcon icon={ExternalLinkIcon} />
							View profile
						</Button>
						<Button
							variant={cleared ? 'secondary' : 'outline'}
							size="sm"
							onclick={handleClearCache}
							disabled={clearing}
						>
							<HugeiconsIcon icon={RefreshIcon} class={clearing ? 'animate-spin' : ''} />
							{clearing ? 'Clearing…' : cleared ? 'Cache cleared' : 'Clear local cache'}
						</Button>
					</div>
				</div>
			</section>
		{:catch err}
			<div class="mt-8 space-y-4 py-6">
				<div class="flex items-center gap-2 text-sm font-semibold text-destructive">
					<HugeiconsIcon icon={AlertCircleIcon} class="size-5" />
					Unable to load account
				</div>
				<p class="text-xs leading-relaxed text-muted-foreground">
					We couldn't fetch your Canvas profile. Check your connection or Canvas configuration.
				</p>
				<p class="rounded-md bg-destructive/10 p-3 font-mono text-xs break-all text-destructive">
					{err instanceof Error ? err.message : String(err ?? 'Unknown error')}
				</p>
				<div class="flex gap-2">
					<Button onclick={() => location.reload()} variant="outline" size="sm">
						<HugeiconsIcon icon={RefreshIcon} />
						Retry
					</Button>
					<Button variant="ghost" size="sm" onclick={handleClearCache}>Clear cache & retry</Button>
				</div>
			</div>
		{/await}
	</div>
</main>
