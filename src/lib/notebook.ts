import { browser } from '$app/environment';
import Dexie, { type EntityTable } from 'dexie';

interface NotebookDoc {
	id: string;
	content: string;
	updatedAt: number;
	title?: string;
	createdAt?: number;
}

function asMarkdownSection(doc: NotebookDoc): string {
	const title = doc.title?.trim();
	if (!title || title === 'Untitled') return doc.content.trim();
	return `# ${title}\n\n${doc.content.trim()}`.trim();
}

const db = browser
	? (new Dexie('gesso-notebook') as Dexie & { docs: EntityTable<NotebookDoc, 'id'> })
	: null;

if (db) {
	db.version(1).stores({ docs: '&id, updatedAt' });
	db.version(2).stores({ docs: '&id, updatedAt, createdAt' });
}

export async function getNotebookContent(): Promise<string> {
	if (!db) return '';
	try {
		const docs = await db.docs.toArray();
		if (docs.length === 0) return '';
		if (docs.length === 1 && docs[0].id === 'main') return docs[0].content;

		const content = docs
			.sort((a, b) => (a.createdAt ?? a.updatedAt) - (b.createdAt ?? b.updatedAt))
			.map(asMarkdownSection)
			.filter(Boolean)
			.join('\n\n---\n\n');
		const updatedAt = Math.max(...docs.map((doc) => doc.updatedAt));

		await db.transaction('rw', db.docs, async () => {
			await db.docs.clear();
			await db.docs.put({ id: 'main', content, updatedAt });
		});
		return content;
	} catch {
		return '';
	}
}

export async function saveNotebookContent(content: string): Promise<void> {
	if (!db) return;
	try {
		await db.docs.put({ id: 'main', content, updatedAt: Date.now() });
	} catch {
		// IndexedDB is unavailable.
	}
}

export async function getNotebookUpdatedAt(): Promise<number | null> {
	if (!db) return null;
	try {
		return (await db.docs.get('main'))?.updatedAt ?? null;
	} catch {
		return null;
	}
}
