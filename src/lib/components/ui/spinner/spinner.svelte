<script lang="ts">
	import { cn } from '$lib/utils';
	import { Loading03Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let { class: className }: { class?: string } = $props();
</script>

<span role="status" aria-label="Loading" class={cn('inline-flex', className)}>
	<HugeiconsIcon icon={Loading03Icon} class="size-4 animate-spin" />
</span>
