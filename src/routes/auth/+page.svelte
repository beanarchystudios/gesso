<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getCanvasCredentials, saveCanvasCredentials } from '$lib/canvas-credentials';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let instanceUrl = $state('');
	let apiKey = $state('');
	let error = $state('');
	let saving = $state(false);

	$effect(() => {
		void getCanvasCredentials().then((credentials) => {
			if (credentials) void goto(resolve('/(app)/dashboard'), { replaceState: true });
		});
	});

	async function save() {
		error = '';
		saving = true;
		try {
			await saveCanvasCredentials(instanceUrl, apiKey);
			await goto(resolve('/(app)/dashboard'), { replaceState: true });
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save your Canvas connection.';
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Connect Canvas | Gesso</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-6">
	<form
		class="w-full max-w-sm space-y-6"
		onsubmit={(event) => {
			event.preventDefault();
			void save();
		}}
	>
		<div class="space-y-1">
			<h1 class="text-xl font-semibold">Connect Canvas</h1>
			<p class="text-sm text-muted-foreground">
				Enter your Canvas URL and access token. Gesso saves them in this browser.
			</p>
		</div>
		<label class="block space-y-2 text-sm font-medium">
			Canvas URL
			<Input
				bind:value={instanceUrl}
				type="url"
				placeholder="https://school.instructure.com"
				autocomplete="url"
				required
			/>
		</label>
		<label class="block space-y-2 text-sm font-medium">
			Access token
			<Input
				bind:value={apiKey}
				type="password"
				placeholder="Paste your token"
				autocomplete="off"
				required
			/>
		</label>
		{#if error}<p class="text-sm text-destructive">{error}</p>{/if}
		<Button type="submit" class="w-full" disabled={saving}>
			{saving ? 'Connecting…' : 'Connect Canvas'}
		</Button>
	</form>
</main>
