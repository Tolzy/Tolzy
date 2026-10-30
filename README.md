# 3D Portrait Studio

An AI-powered web application that turns photographs of real people into
recognisable, interactive 3D portraits — customisable with studio materials and
lighting, exportable as GLB and PNG, and publishable as an embeddable viewer.

**Status:** Milestone 2 — real-time 3D rendering of a CC0 sample head in the
studio. This is a preview build: sign-in, photo upload, generation and exports
are not enabled yet and are labelled as such in the interface. See the [roadmap](docs/roadmap.md).

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

`node scripts/screenshots.mjs http://localhost:3000 <dir>` captures the main
screens at desktop, tablet and phone widths for visual review.

## Documentation

| Document                                                              | Contents                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Roadmap](docs/roadmap.md)                                            | Milestones 0–10 with scope, acceptance criteria, tests, open questions                            |
| [Architecture](docs/architecture.md)                                  | System design, rendering, interaction rig, materials, provider abstraction, jobs, exports, embeds |
| [Data model](docs/data-model.md)                                      | Tables, RLS, settings schema, storage layout, deletion                                            |
| [Design system](docs/design-system.md)                                | Visual language, tokens, components, screen designs                                               |
| [Design references](docs/research/design-references.md)               | Mobbin research and extracted patterns                                                            |
| [Reconstruction providers](docs/research/reconstruction-providers.md) | Provider landscape, criteria, bake-off protocol                                                   |
| [Privacy and security](docs/security-privacy.md)                      | Controls, retention policy, consent copy                                                          |
| [Risks](docs/risks.md)                                                | Ranked risks and mitigations                                                                      |
| [Sample head asset](scripts/sample-head/README.md)                    | Sources, CC0 licences, build pipeline and stats of the bundled sample model                       |
| [Decisions](docs/decisions/)                                          | Architecture decision records                                                                     |

## Planned stack

Next.js · React · TypeScript · Tailwind CSS · Three.js · React Three Fiber ·
Drei · glTF Transform · Zustand · Zod · Sharp · Supabase (Auth, Postgres,
Storage) · Cloudflare R2 · Vercel.

## Configuration

Copy `.env.example` to `.env.local` and fill in the values. Each variable is
documented in that file. Provider credentials are server-only.
