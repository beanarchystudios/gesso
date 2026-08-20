<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getCourseShortcutHref, type CourseShortcutKey } from '$lib/course-shortcuts';

	const SHORTCUT_KEYS = new Set<CourseShortcutKey>(['h', 'm', 'a', 'g', 'n']);

	function handleKeydown(event: KeyboardEvent) {
		const courseId = page.params.courseId;
		const target = event.target as HTMLElement | null;
		const isTyping =
			target?.isContentEditable || target?.matches('input, textarea, select, [role="textbox"]');

		if (
			!courseId ||
			isTyping ||
			event.metaKey ||
			event.ctrlKey ||
			event.altKey ||
			event.shiftKey ||
			event.repeat ||
			!SHORTCUT_KEYS.has(event.key as CourseShortcutKey)
		) {
			return;
		}

		event.preventDefault();
		void goto(getCourseShortcutHref(event.key as CourseShortcutKey, courseId));
	}
</script>

<svelte:window onkeydown={handleKeydown} />
