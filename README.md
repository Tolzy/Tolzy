# Shiplog

**Turn your work into a story.** Shiplog connects to GitHub, finds meaningful development activity, groups related commits and pull requests, and turns them into human-readable product updates published to a branded public changelog.

This repository is an interactive prototype of the full core experience, using a fictional product, **Orbit** (`orbit-labs/orbit`).

```bash
npm install
npm run dev        # http://localhost:3000 → redirects to /app/overview
npm run build && npm start
```

No credentials or backend are needed. The GitHub integration runs in a clearly labelled **demo mode** with simulated data, and all state lives in `localStorage`. You can reset it from **Settings → Reset demo data**.

## The journey

1. **Overview** (`/app/overview`): what changed and what to publish next. It shows suggested stories, drafts, recently published releases, shipping rhythm and recent activity.
2. **Activity** (`/app/activity`): commits and PRs with search, filters (type, author, date), a timeline or grouped view, suggested groups, and a bulk "Create release" action.
3. **New release** (`/app/releases/new`): a five-step flow: select changes → generate story → enrich → preview (desktop/mobile) → publish or schedule.
4. **Editor** (`/app/releases/[id]`): an editorial canvas with a block editor (paragraph, heading, list, image, video, before/after, link, PRs). Blocks can be reordered by dragging or with the move buttons. Details panel, sources panel, unsaved-change guard, ⌘S, unpublish, delete, duplicate.
5. **Public changelog** (`/changelog/orbit`, `/changelog/orbit/[release]`): an editorial publication with a featured release, category filters, rich content, prev/next navigation and copy-link.
6. **Appearance** (`/app/appearance`): name, logo, description, accent, light/dark, layout, density and featured release, with a live preview.
7. **Integrations** (`/app/integrations`): simulated connect/disconnect, a repository picker, sync, a permissions explanation, and demo controls for error and latency states.

Other details:
- **Command menu:** ⌘K / Ctrl+K.
- **Shortcuts:** `C` creates a release, `G` then `O`/`A`/`R`/`P`/`I`/`S` jumps to a section, ⇧⌘L toggles the theme.
- **Second workspace:** "Maya's Sandbox" is empty, to show the empty states.

## Architecture

```
src/
  app/                    Next.js App Router routes (app + public)
  lib/
    types.ts              Domain model: Workspace, Repository, ActivityItem, Release, blocks, MediaAsset…
    story.ts              Deterministic story engine: grouping, category inference, headline/summary/body generation
    demo-data.ts          Internally consistent Orbit dataset
    store.tsx             React hooks over the store (useSyncExternalStore)
    services/
      contracts.ts        RepositoryService, ActivityService, ReleaseService, PublishingService, AppearanceService
      mock.ts             Demo implementations (latency, simulated failures)
      storage.ts / db.ts  StorageService (localStorage) + observable store, cross-tab sync
  components/
    ui/                   Design system primitives (button, dialog, menu, tooltip, toast, form, badge…)
    app/                  Shell, sidebar, command palette, nav guard, activity row
    release/              Block editor, media picker, story fields, preview, publish dialog, illustrations
    changelog/            Public renderer, shared by the editor preview and the public pages
    views/                One component per screen
```

- **Swapping in real GitHub:** implement `RepositoryService` / `ActivityService` against the GitHub API. The UI only depends on the contracts.
- **Real AI generation:** replace `generateStory` in `lib/story.ts`. Its output is already a normal editable `ReleaseDraft`.
- **Adding a block type:** add it to the `ReleaseContentBlock` union, then add an editor case in `block-editor.tsx` and a renderer case in `changelog/blocks.tsx`.

Stack: Next.js 15, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Lucide, Geist + Newsreader.
