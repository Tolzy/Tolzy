# ADR 0002 — Product-owner decisions before Milestone 1

Date: 2026-10-30 · Status: Accepted

## Decisions

1. **Authentication before upload.** Users must sign in before uploading
   photographs or generating portraits. The dashboard and project management
   are tied to authenticated accounts. Implemented with Supabase Auth in
   Milestone 5, before any upload route exists.
2. **No paid provider spend yet.** The ≈ $200 bake-off budget is not approved.
   Rendering work uses a licensed sample head. A separate provider evaluation
   runs before Milestone 6, starting from free tiers, published samples and
   vendor conversations. No paid plan is purchased without explicit approval.
   8–12 consenting volunteers are recruited only after providers are
   shortlisted and consent and privacy procedures are in place.
3. **Retention.** Source photographs are deleted 30 days after generation by
   default. Users can keep their photographs, delete them immediately, and see
   what is stored. Generated models are managed separately with their own
   deletion controls. Photographs and models are private by default.
4. **Theme.** The application interface is light-first. The 3D Studio viewport
   is dark by default, contrasting the clean interface with the creative
   workspace.
5. **Regions.** Nigeria is the initial target market; the architecture supports
   international users. No regional restrictions are hard-coded. Production
   image processing is enabled per region through configuration only after
   provider availability, licensing and privacy requirements have been
   evaluated for that region.

## Consequences

- Milestone 1 ships a preview build: sign-in, upload and generation are visibly
  unavailable rather than simulated.
- The settings model defaults the viewport background to a dark gradient.
- The storage settings page exposes per-asset-type visibility and deletion
  (wired to data in Milestones 5–7).
- Region enablement becomes a configuration value checked server-side before
  any photo is sent to a provider (Milestone 6). For Nigeria, the evaluation
  must cover the Nigeria Data Protection Act 2023 and guidance from the
  Nigeria Data Protection Commission (facial images are sensitive personal
  data), cross-border transfer to the provider's processing region, and the
  provider's availability for Nigerian users. This needs legal review; it is
  not legal advice.
