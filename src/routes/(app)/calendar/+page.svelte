<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity */
	import { getCalendarEvents } from '$lib/canvas';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		ArrowLeft01Icon,
		ArrowRight01Icon,
		Calendar03Icon,
		Cancel01Icon,
		Clock01Icon,
		Search01Icon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	type CalendarItem = Awaited<ReturnType<typeof getCalendarEvents>>[number];

	let cursor = $state(new Date());
	let selected = $state(new Date());
	let search = $state('');
	let selectedEvent = $state<CalendarItem | null>(null);

	let events = $state<CalendarItem[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	function stripHtml(html: string | null) {
		if (!html) return '';
		return html
			.replace(/<[^>]*>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function startOfDay(d: Date) {
		const x = new Date(d);
		x.setHours(0, 0, 0, 0);
		return x;
	}
	function isSameDay(a: Date, b: Date) {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}
	function isToday(d: Date) {
		return isSameDay(d, new Date());
	}
	function addMonths(d: Date, n: number) {
		const x = new Date(d);
		x.setMonth(x.getMonth() + n);
		return x;
	}
	function startOfWeek(d: Date) {
		const x = startOfDay(d);
		x.setDate(x.getDate() - x.getDay());
		return x;
	}
	function toISO(d: Date) {
		return d.toISOString();
	}
	function toISODate(d: Date) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
	function formatTime(iso: string | null) {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	}

	function getMonthMatrix(year: number, month: number) {
		const first = new Date(year, month, 1);
		const start = startOfWeek(first);
		const weeks: Date[][] = [];
		let cur = new Date(start);
		for (let w = 0; w < 6; w++) {
			const week: Date[] = [];
			for (let d = 0; d < 7; d++) {
				week.push(new Date(cur));
				cur.setDate(cur.getDate() + 1);
			}
			weeks.push(week);
			if (w >= 4 && cur.getMonth() !== month && cur.getDate() > 7) break;
		}
		return weeks;
	}

	function rangeFor(cursor: Date) {
		const s = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
		const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
		const end = new Date(startOfWeek(e));
		end.setDate(end.getDate() + 6);
		end.setHours(23, 59, 59, 999);
		s.setDate(s.getDate() - 7);
		end.setDate(end.getDate() + 7);
		return { start: toISO(s), end: toISO(end) };
	}

	let range = $derived(rangeFor(cursor));

	$effect(() => {
		const { start, end } = range;
		let cancelled = false;
		loading = true;
		error = null;
		getCalendarEvents({ start, end })
			.then((data) => {
				if (cancelled) return;
				events = data;
				loading = false;
			})
			.catch((e: unknown) => {
				if (cancelled) return;
				error = e instanceof Error ? e.message : 'Unable to load calendar';
				loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	let matrix = $derived(getMonthMatrix(cursor.getFullYear(), cursor.getMonth()));

	let filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return events;
		return events.filter((ev) => {
			const hay = `${ev.title} ${ev.contextName ?? ''}`.toLowerCase();
			return hay.includes(q) || stripHtml(ev.description).toLowerCase().includes(q);
		});
	});

	function eventsForDay(day: Date, all: CalendarItem[]) {
		const key = toISODate(day);
		return all.filter((ev) => {
			if (!ev.start) return false;
			if (ev.allDay && ev.allDayDate) return ev.allDayDate === key;
			return toISODate(new Date(ev.start)) === key;
		});
	}

	let selectedEvents = $derived.by(() => {
		return eventsForDay(selected, filtered).sort((a, b) => {
			const at = a.start ? new Date(a.start).getTime() : 0;
			const bt = b.start ? new Date(b.start).getTime() : 0;
			return at - bt;
		});
	});

	function hashString(str: string): number {
		let h = 0;
		for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
		return h;
	}

	function eventToken(ev: CalendarItem): string {
		// assignments (and any course event with a Canvas color) should use the course color
		if (ev.color) return ev.color;
		// fallback: cycle through chart-1..5 deterministically per course/context
		const key = ev.courseId ?? ev.contextName ?? ev.title ?? ev.type;
		const hash = hashString(String(key));
		const idx = (hash % 5) + 1;
		return `var(--chart-${idx})`;
	}

	const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<svelte:head>
	<title>Calendar | Gesso</title>
</svelte:head>

<main class="flex size-full flex-col overflow-hidden">
	<!-- header -->
	<div class="shrink-0 border-b px-4 py-3 sm:px-6">
		<div class="flex items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon-sm"
					onclick={() => (cursor = new Date())}
					aria-label="Today"
					class="rounded-full"
				>
					<HugeiconsIcon icon={Calendar03Icon} class="size-4" />
				</Button>
				<div class="hidden items-center gap-1 sm:flex">
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => (cursor = addMonths(cursor, -1))}
						aria-label="Previous month"
						class="rounded-full"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} class="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => (cursor = addMonths(cursor, 1))}
						aria-label="Next month"
						class="rounded-full"
					>
						<HugeiconsIcon icon={ArrowRight01Icon} class="size-4" />
					</Button>
				</div>
				<h1 class="text-lg font-semibold tracking-tight">
					{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
				</h1>
				{#if loading}
					<span class="ml-1 size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true"
					></span>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				<!-- mobile nav -->
				<div class="flex items-center gap-1 sm:hidden">
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => (cursor = addMonths(cursor, -1))}
						aria-label="Previous month"
						class="rounded-full"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} class="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => (cursor = addMonths(cursor, 1))}
						aria-label="Next month"
						class="rounded-full"
					>
						<HugeiconsIcon icon={ArrowRight01Icon} class="size-4" />
					</Button>
				</div>

				<div class="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						bind:value={search}
						placeholder="Search"
						aria-label="Search events"
						class="h-8 w-40 rounded-full pl-9 sm:w-56"
					/>
					{#if search}
						<button
							type="button"
							aria-label="Clear search"
							onclick={() => (search = '')}
							class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
						>
							<HugeiconsIcon icon={Cancel01Icon} class="size-3.5" />
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
		<!-- calendar grid -->
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			{#if error}
				<div class="flex flex-1 items-center justify-center border-y border-dashed p-8 text-center">
					<div>
						<p class="text-sm font-medium">Couldn’t load calendar</p>
						<p class="mt-1 text-sm text-muted-foreground">{error}</p>
						<Button size="sm" variant="outline" class="mt-4" onclick={() => location.reload()}>
							Retry
						</Button>
					</div>
				</div>
			{:else}
				<div class="flex flex-1 flex-col overflow-hidden">
					<div class="grid shrink-0 grid-cols-7 border-r border-b">
						{#each weekdays as w (w)}
							<div class="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
								<span class="hidden sm:inline">{w}</span><span class="sm:hidden">{w[0]}</span>
							</div>
						{/each}
					</div>
					<div class="grid flex-1 auto-rows-fr grid-cols-7">
						{#each matrix.flat() as day (day.toISOString())}
							{@const today = isToday(day)}
							{@const inMonth = day.getMonth() === cursor.getMonth()}
							{@const active = isSameDay(day, selected)}
							{@const dayEvents = eventsForDay(day, filtered)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								onclick={() => (selected = new Date(day))}
								class="flex min-h-0 cursor-pointer flex-col gap-1 border-r border-b p-2 transition-colors [&:nth-last-child(-n+7)]:border-b-0"
							>
								<span
									class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs leading-none {today
										? 'bg-primary font-semibold text-primary-foreground'
										: active
											? 'bg-muted font-medium ring-1 ring-border'
											: inMonth
												? ''
												: 'text-muted-foreground'}"
								>
									{day.getDate()}
								</span>

								<div class="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
									{#each dayEvents.slice(0, 2) as ev (ev.id)}
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												selected = new Date(day);
												selectedEvent = ev;
											}}
											class="flex items-center gap-1.5 truncate rounded-full border px-2 py-1 text-left text-xs leading-none hover:brightness-95"
											style:border-color={`color-mix(in oklab, ${eventToken(ev)} 30%, transparent)`}
											style:background-color={`color-mix(in oklab, ${eventToken(ev)} 14%, transparent)`}
											title={ev.title}
										>
											<span
												class="size-1.5 shrink-0 rounded-full"
												style:background-color={eventToken(ev)}
											></span>
											<span class="truncate text-xs font-medium">{ev.title}</span>
										</button>
									{/each}
									{#if dayEvents.length > 2}
										<span class="px-1 text-xs text-muted-foreground"
											>+{dayEvents.length - 2} more</span
										>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
				{#if !loading && filtered.length === 0}
					<p class="mt-3 shrink-0 text-center text-sm text-muted-foreground">
						No events{search ? ' matching your search' : ' this month'}.
					</p>
				{/if}
			{/if}
		</div>

		<!-- selected day agenda -->
		<div
			class="flex w-full shrink-0 flex-col border-t border-l-0! lg:w-[360px] lg:border-s lg:border-t-0 xl:w-[400px] 2xl:w-[440px]"
		>
			<div class="shrink-0 px-5 py-4">
				<p class="text-sm font-semibold">
					{selected.toLocaleDateString(undefined, {
						weekday: 'long',
						month: 'long',
						day: 'numeric'
					})}
				</p>
				<p class="text-xs text-muted-foreground">
					{selectedEvents.length}
					{selectedEvents.length === 1 ? 'event' : 'events'}
					{#if search}· filtered{/if}
				</p>
			</div>
			<div class="flex-1 overflow-y-auto px-3 pb-4">
				{#if selectedEvents.length === 0}
					<div
						class="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
					>
						No events on this day.
					</div>
				{:else}
					<div class="space-y-2">
						{#each selectedEvents as ev (ev.id)}
							<button
								type="button"
								onclick={() => (selectedEvent = ev)}
								class="flex w-full flex-col gap-1 rounded-xl border px-3 py-3 text-left"
							>
								<div class="flex items-center gap-2">
									<span class="size-2 rounded-full" style:background-color={eventToken(ev)}></span>
									<span class="line-clamp-1 flex-1 text-sm font-medium">{ev.title}</span>
								</div>
								<div class="flex items-center gap-1.5 pl-4 text-xs text-muted-foreground">
									<HugeiconsIcon icon={Clock01Icon} class="size-3" />
									{ev.allDay ? 'All day' : formatTime(ev.start)}
									{#if ev.contextName}
										· <span class="truncate">{ev.contextName}</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if selectedEvent}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
			onclick={(e) => {
				if (e.target === e.currentTarget) selectedEvent = null;
			}}
		>
			<div class="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl">
				<div class="px-5 pt-5">
					<div class="flex items-start justify-between gap-3">
						<div
							class="size-2.5 shrink-0 translate-y-1.5 rounded-full"
							style:background-color={eventToken(selectedEvent)}
						></div>
						<div class="min-w-0 flex-1">
							<h2 class="text-sm leading-snug font-semibold">{selectedEvent.title}</h2>
							<p class="mt-1 text-xs text-muted-foreground">
								{selectedEvent.allDay
									? 'All day'
									: selectedEvent.start
										? new Date(selectedEvent.start).toLocaleString(undefined, {
												weekday: 'short',
												month: 'short',
												day: 'numeric',
												hour: 'numeric',
												minute: '2-digit'
											})
										: ''}
								{#if selectedEvent.contextName}· {selectedEvent.contextName}{/if}
							</p>
						</div>
						<button
							type="button"
							onclick={() => (selectedEvent = null)}
							class="rounded-full p-1 text-muted-foreground"
						>
							<HugeiconsIcon icon={Cancel01Icon} class="size-4" />
						</button>
					</div>
					{#if stripHtml(selectedEvent.description)}
						<p
							class="mt-4 max-h-64 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground"
						>
							{stripHtml(selectedEvent.description)}
						</p>
					{/if}
				</div>
				<div class="mt-5 flex items-center justify-end gap-2 border-t px-5 py-3">
					<Button variant="ghost" size="sm" onclick={() => (selectedEvent = null)}>Close</Button>
					{#if selectedEvent.htmlUrl}
						<Button href={selectedEvent.htmlUrl} target="_blank" rel="noreferrer" size="sm">
							Open in Canvas
						</Button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</main>
