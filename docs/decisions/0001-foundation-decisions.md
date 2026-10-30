# ADR 0001 — Foundation decisions

Date: 2026-10-30 · Status: Proposed (awaiting product-owner approval)

## Context

Milestone 0 of 3D Portrait Studio. The brief fixes most of the stack; this
record captures the choices made where the brief left room, and the reasons.

## Decisions

1. **Next.js App Router with route handlers** for all server logic; no separate
   backend service until a measured limit forces it (see risk R5).
2. **Source photos in Supabase Storage (private bucket), generated assets in
   Cloudflare R2.** Supabase Storage shares auth and RLS with the database,
   which suits sensitive personal photos; R2 has no egress fees, which suits
   large, frequently downloaded GLBs.
3. **Separate public bucket for published embeds.** Publishing copies the
   asset; private buckets never gain public read access.
4. **Radix UI primitives** under our own styled components, for accessibility
   without adopting another product's visual language.
5. **MediaPipe Face Landmarker in the browser** for face pre-checks; server
   validates file-level properties only. Avoids hosting an ML model server-side.
6. **Additive rotation model** for cursor tracking + drag (`track + manual`),
   applied to a parent group; camera stays fixed.
7. **No drei CDN environment presets in production;** environments are built
   from Lightformers or self-hosted CC0 HDRIs.
8. **Reconstruction provider is not chosen.** A provider interface and a
   development-only fixture provider are built first; the choice follows a
   documented bake-off before Milestone 6.
9. **Supabase Realtime for job progress** with polling fallback; provider
   webhooks with Vercel Cron polling fallback.
10. **Dependencies are added per milestone**, each justified in its PR.

## Consequences

- Two storage systems to manage (mitigated by one `lib/storage` facade).
- Face checks depend on client capability; the server cannot verify face
  presence. Acceptable because provider failure is the backstop and the check
  is advisory beyond "no face / many faces".
