# Data model

Status: Milestone 0 proposal. Implemented as Supabase migrations in
Milestone 5–7. All tables live in the `public` schema with Row Level Security
enabled; every policy is scoped to `auth.uid()`.

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

```ts
const PortraitSettings = z.object({
  material: z.object({
    preset: z.enum(["original", "chrome", "obsidian", "ceramic", "glass", "gold"]),
    overrides: z.object({ color: Hex, roughness: Unit, metalness: Unit }).partial().optional(),
  }),
  lighting: z.object({
    preset: z.enum(["studio", "softbox", "rim", "dramatic", "daylight"]),
    intensity: z.number().min(0).max(3),
    rotation: z.number().min(-180).max(180), // environment yaw in degrees
  }),
  background: z.discriminatedUnion("type", [
    z.object({ type: z.literal("solid"), color: Hex }),
    z.object({ type: z.literal("gradient"), from: Hex, to: Hex }),
    z.object({ type: z.literal("transparent") }),
  ]),
  motion: z.object({
    tracking: z.boolean(),
    yawLimit: z.number().min(0).max(60), // default 25
    pitchLimit: z.number().min(0).max(30), // default 12
    sensitivity: Unit, // default 0.65
    damping: z.number().min(1).max(20), // default ≈ 6 (lambda)
    idleReturnMs: z.number().min(0).max(5000), // default 600
    dragRelease: z.enum(["return", "hold"]),
  }),
  camera: z.object({ distance: z.number(), fov: z.number().min(15).max(50) }),
});
```

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
