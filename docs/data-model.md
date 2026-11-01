# Data model

Status: Milestone 0 proposal (production target: Supabase migrations with Row
Level Security, every policy scoped to `auth.uid()`). Milestone 6 implements
the subset below on the local development backend (§0); the Supabase
migrations follow once the project exists.

## 0. As built in Milestone 6 (local backend, `src/lib/server/store.ts`)

| Table       | Fields (as built)                                                                                                                                                                                                         | Maps to (§2)              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `users`     | id, email, name, createdAt                                                                                                                                                                                                | `auth.users` + `profiles` |
| `sessions`  | tokenHash (SHA-256), userId, expiresAt                                                                                                                                                                                    | Supabase Auth sessions    |
| `photos`    | id, ownerId, slot, path, bytes, width, height, createdAt, **deleteAfter**, **keep**                                                                                                                                       | `source_images`           |
| `consents`  | id, ownerId, version, providerId, photoIds, acceptedAt                                                                                                                                                                    | `consents`                |
| `jobs`      | id, ownerId, portraitId, providerId, providerJobId, status, progress, photoIds, consentId, attempts, error {code, message, retryable}, scenario (fixture only), createdAt, updatedAt, submittedAt, finishedAt, nextPollAt | `generation_jobs`         |
| `portraits` | id, ownerId, name, status (generating / ready / failed), providerId, jobId, assetId, thumbnailPath, createdAt                                                                                                             | `portraits`               |
| `assets`    | id, ownerId, portraitId, path (original GLB), bytes, triangles, **manifest** (orientation, confidence, framing, counts, profile)                                                                                          | `model_assets`            |

Every read and write is filtered by `ownerId` in code (the equivalent of
RLS); routes return 404 for other users' rows. Files live under
`DATA_DIR/files/{userId}/…` (photos, models, thumbnails), outside `public/`,
and are served only by authenticated routes. Portrait settings (including
M7 `geometry` and `regionMaterials`) remain in browser storage until M10.

## 1. Entity overview

```
auth.users ─1:1─ profiles
     │
     ├─1:n─ projects ─1:n─ portraits ─1:1─ portrait_settings
     │                         │
     │                         ├─1:n─ source_images
     │                         ├─1:n─ generation_jobs ─1:0..1─ model_assets
     │                         ├─1:n─ model_assets   (portraits.current_asset_id → one of them)
     │                         ├─1:n─ exports
     │                         └─1:0..1─ embeds
     └─1:n─ consents
```

- **Projects are separate from portraits.** A portrait always belongs to one
  project; each user gets a default "Unsorted" project so creation never
  requires choosing one.
- **Settings are separate from geometry.** `portrait_settings` holds the
  customisation document; regenerating the model keeps the settings.

## 2. Tables (draft DDL)

```sql
create type job_status as enum ('pending', 'processing', 'completed', 'failed');
create type image_role as enum ('front', 'left', 'right', 'three_quarter_left', 'three_quarter_right', 'back');
create type export_kind as enum ('glb_original', 'glb_styled', 'png');

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table portraits (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users on delete cascade,
  project_id        uuid not null references projects on delete cascade,
  name              text not null default 'Untitled portrait',
  status            text not null default 'draft'
                    check (status in ('draft', 'generating', 'ready', 'failed')),
  current_asset_id  uuid,                       -- fk added after model_assets
  thumbnail_key     text,                       -- R2 key of latest PNG thumbnail
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table source_images (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users on delete cascade,
  portrait_id    uuid not null references portraits on delete cascade,
  role           image_role not null default 'front',
  storage_path   text not null,                 -- Supabase Storage private bucket
  width          int not null,
  height         int not null,
  bytes          int not null,
  checks         jsonb not null default '{}',   -- face count, yaw, blur score, brightness…
  delete_after   timestamptz,                   -- retention policy
  created_at     timestamptz not null default now()
);

create table generation_jobs (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users on delete cascade,
  portrait_id      uuid not null references portraits on delete cascade,
  provider         text not null,
  provider_job_id  text,
  status           job_status not null default 'pending',
  stage            text,                         -- 'queued' | 'reconstructing' | 'optimising' …
  progress         real check (progress between 0 and 1),
  error_code       text,
  error_message    text,                         -- user-safe message only
  attempts         int not null default 0,
  next_poll_at     timestamptz,
  submitted_at     timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (provider, provider_job_id)
);

create table model_assets (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users on delete cascade,
  portrait_id     uuid not null references portraits on delete cascade,
  job_id          uuid references generation_jobs on delete set null,
  r2_key          text not null,
  bytes           int not null,
  triangle_count  int,
  texture_size    int,
  pipeline_version text not null,
  orientation_fix jsonb not null default '{"x":0,"y":0,"z":0}',
  manifest        jsonb not null default '{}',   -- Model Descriptor: parts, anchors, capabilities (ADR 0006, M7)
  segmentation_version text,                     -- null until the M7 stage has run (backfill target)
  created_at      timestamptz not null default now()
);

alter table portraits
  add constraint portraits_current_asset_fk
  foreign key (current_asset_id) references model_assets on delete set null;

create table portrait_settings (
  portrait_id     uuid primary key references portraits on delete cascade,
  owner_id        uuid not null references auth.users on delete cascade,
  schema_version  int not null default 1,
  settings        jsonb not null,                -- validated by Zod PortraitSettings
  updated_at      timestamptz not null default now()
);

create table exports (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users on delete cascade,
  portrait_id  uuid not null references portraits on delete cascade,
  kind         export_kind not null,
  r2_key       text,
  params       jsonb not null default '{}',      -- resolution, transparent, preset…
  created_at   timestamptz not null default now()
);

create table embeds (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users on delete cascade,
  portrait_id        uuid not null unique references portraits on delete cascade,
  slug               text not null unique,       -- unguessable, ≥ 10 chars
  public_asset_key   text not null,              -- copy in public bucket
  settings_snapshot  jsonb not null,             -- frozen at publish time
  allowed_origins    text[],                     -- null = any
  is_active          boolean not null default true,
  published_at       timestamptz not null default now(),
  unpublished_at     timestamptz
);

create table consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  kind        text not null check (kind in ('external_processing', 'model_training')),
  version     text not null,                     -- policy version accepted
  granted     boolean not null,
  created_at  timestamptz not null default now()
);
```

Indexes: `(owner_id, updated_at desc)` on portraits and projects;
`(status, next_poll_at)` on generation_jobs; trigram index on
`portraits.name` for search.

## 3. Row Level Security

Every table: `enable row level security` and owner-only policies:

```sql
create policy "owner can read"   on portraits for select using (owner_id = auth.uid());
create policy "owner can write"  on portraits for all    using (owner_id = auth.uid())
                                                         with check (owner_id = auth.uid());
```

- `generation_jobs` and `model_assets` are **written only by the server**
  (service role) — users get select-only policies, so a client cannot forge a
  completed job.
- The public embed page reads `embeds` through a server route using the service
  role, filtered by `slug` and `is_active`; there is no anonymous table policy.

## 4. Portrait settings document

Stored as JSON, validated by a shared Zod schema, versioned with
`schema_version` so later migrations can upgrade old documents.

**As built (M4, schema version 1):** `src/lib/studio/schema.ts` validates
`material` (preset, tint, roughness, metalness, clearcoat, thickness,
opacity), `lighting` (preset, intensity, rotation, color, ambient, shadows,
shadowIntensity), `background` and `motion`, each section falling back to
defaults independently. Saved per portrait on the device until server
persistence (`portrait_settings`) arrives in M10.

**Version 2 (planned, ADR 0006)** has one slice per scene layer:

```ts
const Hex = z.string().regex(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i); // sRGB, optional alpha

const PortraitSettingsV2 = z.object({
  geometry: z.object({
    // M7
    preset: z.enum(["head", "headNeck", "bust", "custom"]),
    parts: z.array(PartId).optional(),
  }),
  material: z.object({
    // M4 (as built) + opacity via tint alpha
    preset: z.enum(["original", "chrome", "obsidian", "ceramic", "glass", "gold"]),
    tint: Hex,
    roughness: Unit,
    metalness: Unit,
    clearcoat: Unit,
    thickness: z.number().min(0.05).max(1.5),
  }),
  lighting: z.object({
    // M4 (as built)
    preset: z.enum(["studio", "dramatic", "soft", "rim", "neutral"]),
    intensity: z.number().min(0).max(3),
    rotation: z.number().min(-180).max(180),
    shadows: z.boolean(),
  }),
  scene: z.object({
    background: z.discriminatedUnion("type", [
      z.object({ type: z.literal("solid"), color: Hex }),
      z.object({ type: z.literal("gradient"), from: Hex, to: Hex }),
      z.object({ type: z.literal("transparent") }),
    ]),
    camera: z.object({ zoom: z.number() }),
  }),
  motion: MotionSettings, // M3 (as built)
  effects: z.object({
    // M8–M9
    eyes: EyeEffectSettings, // docs/specs/eye-effects.md §5
    stack: z.array(EffectInstance).max(8), // docs/specs/effects-studio.md §7
  }),
});
```

Migration v1 → v2: move `background` under `scene`, add `geometry`
(`bust`) and an empty `effects`; 6-digit colours stay valid.

## 5. Storage layout

| Store                | Bucket / prefix                                                      | Visibility                                                               |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Source photos        | Supabase Storage `source-images/{userId}/{portraitId}/{imageId}.jpg` | Private; RLS on `storage.objects` by path prefix; signed URLs (≤ 10 min) |
| Generated models     | R2 `models/{userId}/{portraitId}/{assetId}.glb`                      | Private; presigned GET (≤ 15 min)                                        |
| Exports / thumbnails | R2 `exports/{userId}/{portraitId}/{exportId}.png`                    | Private; presigned GET                                                   |
| Published embeds     | R2 public bucket `p/{slug}/{assetId}.glb`                            | Public, only after explicit publish; deleted on unpublish                |

## 6. Deletion

Deleting a portrait deletes database rows by cascade **and** storage objects
(source photos, models, exports, public copies) through a server routine, and
calls the provider's deletion endpoint when it has one. Account deletion runs
the same routine for every portrait.
