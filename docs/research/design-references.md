# Design reference research

Status: Milestone 0 · Source: Mobbin MCP integration (web platform), October 2026.

Mobbin was available and was used for this research. Every reference below was
inspected as a screenshot through the Mobbin integration. Products listed in the
brief that did **not** come back from Mobbin (Blender, Linear, Apple software)
are referenced from general product knowledge only and are marked as such.

## 1. What was searched

| Query | Purpose |
| --- | --- |
| Design editor with canvas and properties panel | Studio layout, inspector anatomy |
| 3D viewer editor with material settings | Viewport treatment, 3D result screens |
| Framer editor properties panel | Property row density, section disclosure |
| AI image generation upload and progress (flows) | Upload → generate → result → error flows |
| Creative tool project dashboard with recent files grid | Dashboard, recents, project organisation |
| Share and embed code dialog | Publishing, privacy, embed snippets |
| Photo upload dropzone with guidelines and validation | Upload constraints and validation copy |

## 2. References and extracted patterns

### Editors and properties panels

- **Framer — Style inspector**
  ([1](https://mobbin.com/screens/fda44be0-179a-4351-9b36-8607c20e2b91),
  [2](https://mobbin.com/screens/fd321aa9-ae4a-4b7b-bf4a-31b5421003e4),
  [3](https://mobbin.com/screens/f1cb4774-c080-42d5-aafe-a62cd6a45f3e))
  - Right inspector ≈ 260–280 px. Sections (Position, Size, Styles, Effects) are
    separated by a hairline and a small semibold heading, not by cards.
  - Two-column property rows: muted label on the left (~40 %), control on the
    right. Row height ≈ 28–32 px, label text ≈ 11–12 px.
  - Optional sections collapse to a single heading row with a `+` affordance
    ("Effects +", "Transforms +"). Settings appear only when used — strong
    progressive disclosure.
  - Binary options use segmented controls ("Yes / No"), not toggles.
  - Number input paired with an inline slider for continuous values (Opacity).
  - Floating bottom-centre tool pill with zoom percentage; canvas stays the hero.
- **Recraft — canvas editor**
  ([screen](https://mobbin.com/screens/496031c0-0ec2-4f2e-8bf1-df9a851049d6))
  - Floating vertical tool rail on the left, detached from the edge.
  - Right panel is flat (no shadows), label-above-control layout, grey fills
    for inputs instead of borders.
- **Descript — properties rail**
  ([screen](https://mobbin.com/screens/53b0795d-a62e-4d6a-8252-e9df70e6d574))
  - A narrow vertical icon rail switches the inspector's context (Project,
    AI tools, Properties, Elements). Useful for our Material / Light / Scene /
    Motion split without stacking everything in one long scroll.
  - "Color adjustments" uses visual preset thumbnails (None / Neutral / Warm /
    Cool) — a direct analogue for a material swatch library.
- **Klaviyo — drill-in panel**
  ([screen](https://mobbin.com/screens/00d9cdde-80c9-4acf-b097-9271262da1e8))
  - Panel header with back chevron to navigate into a sub-panel. Good model
    for "Material → Advanced".
- **Shopify — image editor**
  ([screen](https://mobbin.com/screens/431611b7-db85-45c6-8cee-cf60a69aa2c2))
  - Near-black canvas, file name top-left, Discard / Save top-right.
  - Right column of accordion tools where only one tool is open at a time.

### 3D result presentation

- **Microsoft Copilot — 3D generation result**
  ([screen](https://mobbin.com/screens/81380eb5-13d0-48dc-8726-fc49e62d638f))
  - The closest reference to our viewport. Full-bleed, warm light-grey
    backdrop with a soft radial falloff and a contact shadow under the object.
  - A small floating card holds the source image thumbnail plus Recreate /
    Download / Share. A two-state toggle (solid / wireframe) sits bottom-centre.
  - Lesson: very little chrome is needed around a 3D result; the soft
    backdrop and grounding shadow carry the "premium" feel.

### Generation flows

- **Obvious — generate from uploaded image**
  ([flow](https://mobbin.com/flows/bc9b1fc4-affc-4f2b-b627-d48dbf7e43f0))
  - Upload progress is shown inline in the drop target ("Uploading… 7 %").
  - Failure state: centred icon, plain-language title ("Failed to load file"),
    one-sentence cause, primary + secondary action (Try again / Download original).
- **Midjourney — image prompt upload**
  ([flow](https://mobbin.com/flows/5cb8b2cd-108a-4426-a041-c46928597110))
  - Drop zone expands inline from the create bar; uploaded references appear
    as small thumbnails with lock/delete actions.
- **Runway — generate**
  ([flow](https://mobbin.com/flows/8d99aa03-14fe-46e6-b0b4-df2a9e046ec5))
  - Left parameter panel with a fixed bottom "Generate" button and model
    selector; notification prompt "Get notified when your generations are
    complete" — relevant for multi-minute reconstruction jobs.
- **Perplexity — attach image**
  ([flow](https://mobbin.com/flows/362c0ef4-d868-4feb-bca7-aa925b8703bf))
  - Attachment state replaces the "Attach" label in place
    (Attach → Uploading… → filename). Minimal, no modal.

### Upload constraints

- **Meetup** ([screen](https://mobbin.com/screens/14220ec2-72bd-48e9-81b4-5939534c86ec)),
  **Square** ([screen](https://mobbin.com/screens/610ae606-5a0f-43d0-9787-9a5dfd893f8d)),
  **Plane** ([screen](https://mobbin.com/screens/63d419df-49f0-4013-b2cd-1b4adb22463c))
  - Constraints are stated before upload (formats, max size, min width).
  - Plane uses a portrait silhouette inside the drop zone — a clear signifier
    for "upload a face". We go further and show live per-check results.
- **WeTransfer** ([screen](https://mobbin.com/screens/dee926a2-0bd4-4e76-9c20-1affc4097c24))
  - Rights notice under the drop zone ("only content you hold rights on") —
    we need the equivalent consent line for photos of people.

### Dashboard and project organisation

- **Descript — Recents**
  ([screen](https://mobbin.com/screens/75945354-f320-4626-b775-2e069eb49402))
  - Large page title, All / Owned-by-me chips, filter, sort ("Last viewed"),
    grid/list toggle. Cards are only thumbnail + title + one meta line.
- **MagicPath — My files**
  ([screen](https://mobbin.com/screens/77bb103c-dca2-4181-b1b3-a60d7cd0f96b))
  - First grid tile is "Create a new design" (dashed). Context menu:
    Rename / Duplicate / Share / Delete (destructive in red, separated).
- **Replit — home**
  ([screen](https://mobbin.com/screens/de9d3a10-54ee-4b13-ac53-08f0b540102e))
  - Centred "what do you want to make" entry point with recents below.
- **Recraft — Projects**
  ([screen](https://mobbin.com/screens/49335990-2d13-48f2-93fc-73a24b024655)),
  **Bloom** ([screen](https://mobbin.com/screens/1b1cf708-59cf-45e5-bed1-5b3bce107327))
  - Counter-examples: promotional banners, update pop-overs and card mosaics
    compete with the user's own work. Avoid.

### Sharing, publishing and embeds

- **Higgsfield — share**
  ([screen](https://mobbin.com/screens/86ab7ca2-9e84-479e-addb-bfb91fefbeed))
  - Explicit Private / Public choice as two selectable tiles with one-line
    consequences ("Only you can access" / "Anyone with the link"). Ideal for
    "public embeds require explicit user action".
- **Searchable** ([screen](https://mobbin.com/screens/a40d434f-7be6-4319-97c1-eb66e861e37e)),
  **Mistral** ([screen](https://mobbin.com/screens/105c1226-6cc7-40da-b290-f5d2393f1a96))
  - "Sharing" status pill, copy-link button that confirms in place ("Copied"),
    a clearly labelled destructive "Stop sharing".
- **Sweatpals — embed settings**
  ([screen](https://mobbin.com/screens/64a1f36b-18a4-4536-8864-3d9abd693f94),
  [code dialog](https://mobbin.com/screens/df1c0114-ba68-4066-8f95-51ac5fbc8d65))
  - Settings on the left, live preview on the right with Desktop / Mobile
    toggle, then "Get code". We adopt the live-preview + device toggle, but
    keep the snippet short (an iframe with `aspect-ratio`) rather than a long
    query-string script.

## 3. Synthesised principles for 3D Portrait Studio

1. **Viewport first.** The canvas is full-bleed behind all chrome. Chrome
   floats or docks at the edges; nothing sits between the user and the head.
2. **Flat inspector.** Sections divided by hairlines and headings, never cards.
   Two-column rows (label / control), 12–13 px type, 32 px row rhythm.
3. **Presets before parameters.** Every domain (material, light, background,
   motion) opens on a visual preset grid. Numeric controls live behind an
   "Adjust" disclosure.
4. **Context rail.** A slim icon rail switches the inspector between
   Material, Light, Scene, Motion and Export, so no panel ever scrolls far.
5. **Honest async states.** Inline progress, stage names, leave-and-come-back,
   plain-language failures with a primary recovery action.
6. **Explicit publishing.** Private by default; going public is a deliberate
   tile choice with consequences spelled out, reversible with "Stop sharing".
7. **One accent.** Neutral UI, near-black / near-white primary buttons, a
   single accent reserved for selection and focus.

## 4. Not inspected

Blender, Linear and Apple products were not returned by these Mobbin queries.
Statements about them in other documents are based on general familiarity with
the products, not on inspected screens during this research.
