/**
 * Strip HTML tags and decode common entities.
 * Shared across search indexing, inbox, and calendar views.
 */
export function stripHtml(value: string | null | undefined, maxLength = 5000): string {
	if (!value) return '';
	return value
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength);
}

export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength) + '…';
}
