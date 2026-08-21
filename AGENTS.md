## Domain language

Read `CONTEXT.md` before naming anything. Notebook and Pages are different things. Never treat them as one feature, never share types or storage between them, and never call one by the other's name.

- Notebook is the sidebar editor. Local Dexie textarea. Code: `src/lib/notebook.ts`, route `/(app)/notebook`. IndexedDB is `gesso-notebook`.
- Pages are a course's Canvas wiki. Routes under `/(app)/courses/[courseId]/pages/[pageId]`. Talk to Canvas pages/wiki APIs, not Dexie. Canvas may label that tab "Notebook". That tab is still Pages.

## Checking

- Run `bun run check` and `bun run lint` before considering yourself to be done.
