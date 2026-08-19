<script>
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="flex h-screen w-screen flex-col items-center justify-center gap-1">
	<h1 class="text-5xl font-bold text-chart-2">Gesso</h1>
	<h2 class="text-muted-foreground">The truly silent classroom.</h2>

	<Button href={resolve('/(app)/dashboard')}>Get Started</Button>
</div>
