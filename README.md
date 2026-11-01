# 3D Portrait Studio

An AI-powered web application that turns photographs of real people into
recognisable, interactive 3D portraits — customisable with studio materials and
lighting, exportable as GLB and PNG, and publishable as an embeddable viewer.

**Status:** Milestones 4 and 5 in review — studio materials (with opacity),
lighting, backgrounds and a full colour picker on the sample head; Dark and
Light themes across the app; photo selection with on-device validation
(MediaPipe). This is a preview build: sign-in, photo upload, generation and
exports are not enabled yet and are labelled as such in the interface. See
the [roadmap](docs/roadmap.md).

## Development

Requires Node.js 22+.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. Useful routes: `/dashboard`, `/create`,
`/studio/sample`, `/settings/storage`, and `/dev/components` (component
gallery, development only).

| Command             | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `npm run lint`      | ESLint                                         |
| `npm run typecheck` | Generate route types and run `tsc`             |
| `npm test`          | Unit tests (Vitest)                            |
| `npm run test:e2e`  | Builds, starts and runs Playwright + axe tests |
| `npm run format`    | Prettier                                       |

`npm run dev` and `npm run build` first copy MediaPipe's WebAssembly runtime
into `public/vendor` (`scripts/vendor-mediapipe.mjs`, git-ignored). Photo-check
fixtures are renders of the CC0 sample head (`tests/fixtures/photos`).

`node scripts/screenshots.mjs http://localhost:3000 <dir>` captures the main
screens at desktop, tablet and phone widths for visual review.

## Documentation

| Document                                                              | Contents                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Roadmap](docs/roadmap.md)                                            | Milestones 0–13 with scope, acceptance criteria, tests, open questions                            |
| [Architecture](docs/architecture.md)                                  | System design, rendering, interaction rig, materials, provider abstraction, jobs, exports, embeds |
| [Data model](docs/data-model.md)                                      | Tables, RLS, settings schema, storage layout, deletion                                            |
| [Design system](docs/design-system.md)                                | Visual language, tokens, components, screen designs                                               |
| [Design references](docs/research/design-references.md)               | Mobbin research and extracted patterns                                                            |
| [Reconstruction providers](docs/research/reconstruction-providers.md) | Provider landscape, criteria, bake-off protocol                                                   |
| [Provider comparison](docs/research/provider-comparison.md)           | M6 comparison, costs, licensing gates, recommendation                                             |
| [Segmentation architecture](docs/segmentation-architecture.md)        | M7 model parts: cuts, caps, regions, guarantees, limitations                                      |
| [Privacy and security](docs/security-privacy.md)                      | Controls as built, retention, NDPA 2023 checklist, consent copy                                   |
| [Risks](docs/risks.md)                                                | Ranked risks and mitigations                                                                      |
| [Sample head asset](scripts/sample-head/README.md)                    | Sources, CC0 licences, build pipeline and stats of the bundled sample model                       |
| [Decisions](docs/decisions/)                                          | Architecture decision records                                                                     |
| [Feature specs](docs/specs/)                                          | Colour picker, model parts, eye effects, Effects Studio                                           |
| [Feature dependencies](docs/feature-dependencies.md)                  | How planned features depend on each other and on milestones                                       |

## Planned stack

Next.js · React · TypeScript · Tailwind CSS · Three.js · React Three Fiber ·
Drei · glTF Transform · Zustand · Zod · Sharp · Supabase (Auth, Postgres,
Storage) · Cloudflare R2 · Vercel.

## Configuration

Copy `.env.example` to `.env.local` and fill in the values. Each variable is
documented in that file. Provider credentials are server-only.

### Trying generation locally (no external service, no cost)

```bash
LOCAL_BACKEND=1 RECONSTRUCTION_PROVIDER=fixture npm run dev
```

Sign in with any email (local accounts only), add photos on `/create`, and
choose **Upload and generate**. The development fixture runs the real
upload, consent, job, validation and Studio steps. It returns a bundled CC0
model, not a reconstruction of your photo, and the UI says so. To try other
cases, add `?scenario=fused`, `fail-once`, `fail`, `invalid-glb` or `slow` to
`/create`.

| Variable                           | Purpose                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `LOCAL_BACKEND=1`                  | Enables the local accounts/storage backend (refused when `VERCEL` is set) |
| `DATA_DIR`                         | Where local data lives (default `.data`, git-ignored)                     |
| `RECONSTRUCTION_PROVIDER`          | `fixture` (development) or `meshy`                                        |
| `FIXTURE_DURATION_MS`              | How long the fixture "reconstructs" (default 9000)                        |
| `RECONSTRUCTION_POLL_MS`           | Provider polling interval (default 2000)                                  |
| `RECONSTRUCTION_API_KEY`           | Server-only provider key                                                  |
| `RECONSTRUCTION_PROVIDER_APPROVED` | Must be `1` for an external provider to run: approval of spending         |
| `CRON_SECRET`                      | Bearer secret for `/api/cron/maintenance` (job polling, photo retention)  |
