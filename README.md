# 3D Portrait Studio

An AI-powered web application that turns photographs of real people into
recognisable, interactive 3D portraits — customisable with studio materials and
lighting, exportable as GLB and PNG, and publishable as an embeddable viewer.

**Status:** Milestone 0 — research, architecture and plan. No application code
yet; implementation starts at Milestone 1 after the plan is approved.

## Documentation

| Document | Contents |
| --- | --- |
| [Roadmap](docs/roadmap.md) | Milestones 0–10 with scope, acceptance criteria, tests, open questions |
| [Architecture](docs/architecture.md) | System design, rendering, interaction rig, materials, provider abstraction, jobs, exports, embeds |
| [Data model](docs/data-model.md) | Tables, RLS, settings schema, storage layout, deletion |
| [Design system](docs/design-system.md) | Visual language, tokens, components, screen designs |
| [Design references](docs/research/design-references.md) | Mobbin research and extracted patterns |
| [Reconstruction providers](docs/research/reconstruction-providers.md) | Provider landscape, criteria, bake-off protocol |
| [Privacy and security](docs/security-privacy.md) | Controls, retention policy, consent copy |
| [Risks](docs/risks.md) | Ranked risks and mitigations |
| [Decisions](docs/decisions/) | Architecture decision records |

## Planned stack

Next.js · React · TypeScript · Tailwind CSS · Three.js · React Three Fiber ·
Drei · glTF Transform · Zustand · Zod · Sharp · Supabase (Auth, Postgres,
Storage) · Cloudflare R2 · Vercel.

## Configuration

Copy `.env.example` to `.env.local` and fill in the values. Each variable is
documented in that file. Provider credentials are server-only.
