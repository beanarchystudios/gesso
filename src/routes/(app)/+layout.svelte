<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import AppSidebar from './app-sidebar.svelte';

	const { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset class="max-h-screen overflow-hidden">
		{@render children()}
	</Sidebar.Inset>
</Sidebar.Provider>
