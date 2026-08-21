# Gesso

A Canvas client for schoolwork. Course material lives in Canvas. Personal writing does not.

The landing page calls it "The truly silent classroom." Gesso loads courses, calendar, inbox, and course tabs from your school's Canvas. Your own notes stay in this browser.

## Run it

You need [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

Open http://localhost:5173 and click Get Started. The next screen asks for a Canvas URL and an access token.

## Connect Canvas

In Canvas, open Account, then Settings, then Approved Integrations, then New Access Token. Paste that token into Gesso with your instance URL, for example `https://school.instructure.com`.

The URL must be HTTPS. Gesso rejects private hosts such as localhost.

Credentials live in IndexedDB on this browser. Gesso copies them into cookies so remote functions can call Canvas. Disconnect from Account to delete both.

## Using it

The dashboard shows favorite courses. The sidebar has dashboard, courses, calendar, inbox, and notebook. Open a course and Gesso follows the tabs Canvas already shows: home, modules, assignments, announcements, discussions, people, grades, syllabus, collaborations, chat, and pages.

Assignments are readable. Submitting still happens in Canvas. Chat opens Canvas's launch URL. Inbox can star, archive, and reply.

On a course page, `h` `m` `a` `g` `n` jump to home, modules, assignments, grades, and announcements.

Press `/`, Cmd+K, or Ctrl+K for search. With enhanced search off, it lists course names. Turn it on in Account to index assignments, pages, inbox, and calendar events in the browser with Orama. Courses index one at a time. Rebuild from Account when the index is stale.

Canvas responses cache in IndexedDB. Fresh for five minutes. After that Gesso returns the cached copy and refreshes in the background. After seven days it fetches again. Clear the cache from Account.

## Notebook is not pages

**Notebook.** A local textarea in the sidebar. The notes belong to you, not to a course. It autosaves 600ms after you stop typing. Dexie stores the document in `gesso-notebook`.

**Pages.** A course's wiki on Canvas. Routes sit under `/courses/[courseId]/pages/[pageId]`. Gesso talks to the Canvas pages API. Nothing in pages goes through Dexie. Canvas may label that tab "Notebook". That tab is still Pages.

## Scripts

```sh
bun run dev
bun run build
bun run preview
bun run check
bun run lint
bun run format
```

`check` runs svelte-check. `lint` runs Prettier and ESLint.

## Stack

SvelteKit 2, Svelte 5, Tailwind 4. Canvas calls go through SvelteKit remote functions. Dexie holds credentials, the Canvas cache, search settings, and the notebook. Orama builds the enhanced search index in the browser.
