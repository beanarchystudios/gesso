<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getCanvasCredentials } from '$lib/canvas-credentials';

	const { children } = $props();
	let ready = $state(false);

	$effect(() => {
		void getCanvasCredentials().then((credentials) => {
			if (!credentials) {
				void goto(resolve('/auth'), { replaceState: true });
				return;
			}
			ready = true;
		});
	});
</script>

{#if ready}
	{@render children()}
{/if}
