// Core domain model for Shiplog. UI components depend on these types only,
// never on the shape of the mock data that happens to back them.

export type ID = string;

export type Category =
  | "feature"
  | "improvement"
  | "fix"
  | "performance"
  | "security"
  | "other";

export interface User {
  id: ID;
  name: string;
  handle: string;
  /** Hue (0–360) used to render a deterministic avatar. */
  hue: number;
}

export interface Workspace {
  id: ID;
  name: string;
  /** Public changelog slug — /changelog/[slug] */
  slug: string;
  initials: string;
  plan: string;
}

export interface Repository {
  id: ID;
  workspaceId: ID;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description: string;
  language: string;
}

export type ActivityType = "commit" | "pull_request";

export interface ActivityItem {
  id: ID;
  repoId: ID;
  type: ActivityType;
  /** Conventional-commit style title, e.g. `feat(theme): support dark mode` */
  title: string;
  description: string;
  authorId: ID;
  createdAt: string;
  sha: string;
  /** Pull request number, when type === "pull_request" */
  number?: number;
  branch: string;
  additions: number;
  deletions: number;
  url: string;
}

export type MediaPreset =
  | "workspaces"
  | "dashboard-light"
  | "dashboard-dark"
  | "dashboard-loading"
  | "dashboard-fast"
  | "invites"
  | "billing"
  | "audit"
  | "command"
  | "mobile-nav";

/** An image the release can show. Illustrations are rendered in code so the
 * demo works offline; uploads/URLs are real images supplied by the user. */
export type MediaAsset =
  | { kind: "illustration"; preset: MediaPreset; alt: string }
  | { kind: "url"; src: string; alt: string }
  | { kind: "upload"; src: string; alt: string; name: string };

interface BlockBase {
  id: ID;
}

export type ReleaseContentBlock =
  | (BlockBase & { type: "heading"; text: string })
  | (BlockBase & { type: "paragraph"; text: string })
  | (BlockBase & { type: "list"; items: string[] })
  | (BlockBase & { type: "image"; media: MediaAsset | null; caption: string })
  | (BlockBase & { type: "video"; url: string; title: string; caption: string })
  | (BlockBase & { type: "link"; url: string; label: string; description: string })
  | (BlockBase & {
      type: "comparison";
      before: MediaAsset | null;
      after: MediaAsset | null;
      beforeLabel: string;
      afterLabel: string;
      caption: string;
    })
  | (BlockBase & { type: "pull_requests"; activityIds: ID[] });

export type BlockType = ReleaseContentBlock["type"];

export type ReleaseStatus = "draft" | "scheduled" | "published";

export interface Release {
  id: ID;
  workspaceId: ID;
  slug: string;
  title: string;
  summary: string;
  category: Category;
  status: ReleaseStatus;
  blocks: ReleaseContentBlock[];
  activityIds: ID[];
  cover: MediaAsset | null;
  /** The date shown on the changelog (yyyy-mm-dd). */
  releaseDate: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  scheduledFor?: string;
}

/** The editable portion of a release. */
export type ReleaseDraft = Pick<
  Release,
  "title" | "summary" | "category" | "blocks" | "activityIds" | "cover" | "releaseDate" | "version"
>;

export type IntegrationStatus = "connected" | "disconnected" | "syncing" | "error";

export interface Integration {
  provider: "github";
  /** Shiplog is running against simulated data. Always "demo" in the prototype. */
  mode: "demo" | "live";
  status: IntegrationStatus;
  account: string | null;
  connectedRepoIds: ID[];
  lastSyncedAt: string | null;
  lastError: string | null;
}

export type PublicTheme = "light" | "dark";
export type PublicLayout = "timeline" | "journal";
export type PublicDensity = "comfortable" | "compact";

export interface Appearance {
  productName: string;
  /** Uploaded logo as a data URL; when null, a monogram is generated. */
  logo: string | null;
  description: string;
  accent: string;
  theme: PublicTheme;
  layout: PublicLayout;
  density: PublicDensity;
  showFeatured: boolean;
  websiteUrl: string;
}

export interface SuggestedGroup {
  id: ID;
  key: string;
  title: string;
  category: Category;
  activityIds: ID[];
  rationale: string;
}
