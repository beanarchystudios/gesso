<script lang="ts">
	import { onMount } from 'svelte';
	import { getNotebookContent, getNotebookUpdatedAt, saveNotebookContent } from '$lib/notebook';
	import { Button } from '$lib/components/ui/button';
	import { Copy01Icon, Delete02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let content = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let savedAt = $state<number | null>(null);
	let textareaEl: HTMLTextAreaElement | undefined = $state(undefined);
	let copySuccess = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		try {
			content = await getNotebookContent();
			savedAt = await getNotebookUpdatedAt();
		} finally {
			loading = false;
			requestAnimationFrame(() => textareaEl?.focus());
		}
	});

	$effect(() => {
		if (loading) return;
		const value = content;
		if (saveTimer) clearTimeout(saveTimer);
		saving = true;
		saveTimer = setTimeout(async () => {
			await saveNotebookContent(value);
			saving = false;
			savedAt = Date.now();
		}, 600);
		return () => {
			if (saveTimer) clearTimeout(saveTimer);
		};
	});

	const wordCount = $derived.by(() => {
		const text = content.trim();
		return text ? text.split(/\s+/).length : 0;
	});
	const charCount = $derived(content.length);
	const readingTime = $derived(Math.max(1, Math.ceil(wordCount / 200)));

	function formatSavedAt(timestamp: number) {
		return `Saved ${new Date(timestamp).toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit'
		})}`;
	}

	async function handleClear() {
		if (!confirm('Clear notebook? This cannot be undone.')) return;
		content = '';
		await saveNotebookContent('');
		savedAt = Date.now();
		requestAnimationFrame(() => textareaEl?.focus());
	}

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(content);
			copySuccess = true;
			setTimeout(() => (copySuccess = false), 1500);
		} catch {
			// Clipboard access was denied.
		}
	}

	function saveNow() {
		if (saveTimer) clearTimeout(saveTimer);
		saving = true;
		saveNotebookContent(content).then(() => {
			saving = false;
			savedAt = Date.now();
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			saveNow();
		}
		if (event.key !== 'Tab' || !textareaEl || document.activeElement !== textareaEl) return;
		event.preventDefault();
		const start = textareaEl.selectionStart ?? 0;
		const end = textareaEl.selectionEnd ?? 0;
		content = `${content.slice(0, start)}  ${content.slice(end)}`;
		requestAnimationFrame(() => {
			if (!textareaEl) return;
			textareaEl.selectionStart = textareaEl.selectionEnd = start + 2;
		});
	}
</script>

<svelte:head>
	<title>Notebook | Gesso</title>
</svelte:head>

<main
	class="flex size-full min-h-0 flex-col overflow-hidden bg-background"
	onkeydown={handleKeydown}
	role="presentation"
>
	<div class="shrink-0 border-b border-transparent">
		<div
			class="mx-auto flex w-full max-w-3xl items-center gap-1 px-4 py-3 md:px-6 lg:max-w-[720px]"
		>
			<Button
				variant="ghost"
				size="icon-sm"
				class="size-8 rounded-full"
				aria-label="Copy notebook"
				onclick={handleCopy}
				disabled={loading || !content}
				title="Copy"
			>
				{#if copySuccess}
					<HugeiconsIcon icon={Tick02Icon} class="size-4 text-chart-1" />
				{:else}
					<HugeiconsIcon icon={Copy01Icon} class="size-4" />
				{/if}
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				class="size-8 rounded-full text-muted-foreground hover:text-destructive"
				aria-label="Clear notebook"
				onclick={handleClear}
				disabled={loading}
				title="Clear"
			>
				<HugeiconsIcon icon={Delete02Icon} class="size-4" />
			</Button>
		</div>
	</div>

	<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
		<div
			class="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 md:px-6 md:py-10 lg:max-w-[720px]"
		>
			{#if loading}
				<div class="space-y-3 py-10">
					<div class="h-6 w-3/4 animate-pulse rounded bg-muted"></div>
					<div class="h-4 w-full animate-pulse rounded bg-muted/70"></div>
					<div class="h-4 w-5/6 animate-pulse rounded bg-muted/60"></div>
				</div>
			{:else}
				<textarea
					bind:this={textareaEl}
					bind:value={content}
					placeholder="Start writing…"
					aria-label="Notebook editor"
					class="h-full min-h-0 w-full flex-1 resize-none overflow-y-auto border-0 bg-transparent p-0 font-sans text-[17px] leading-8 tracking-[-0.01em] text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none md:text-[18px] md:leading-8"
					autocomplete="off"
					spellcheck="true"></textarea>
			{/if}
		</div>

		<div class="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur">
			<div
				class="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-2.5 text-xs text-muted-foreground md:px-6 lg:max-w-[720px]"
			>
				<span class="tabular-nums"
					>{wordCount}
					{wordCount === 1 ? 'word' : 'words'} · {charCount} characters · ~{readingTime} min</span
				>
				<span class="hidden tabular-nums sm:inline">
					{#if saving}Saving…{:else if savedAt}{formatSavedAt(savedAt)}{/if}
				</span>
			</div>
		</div>
	</div>
</main>
