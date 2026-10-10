// Demo dataset for the fictional product "Orbit". Everything here is
// internally consistent: activity referenced by a release belongs to the
// same repository and predates the release.

import type {
  ActivityItem,
  Appearance,
  Integration,
  Release,
  Repository,
  User,
  Workspace,
} from "./types";

export const USERS: User[] = [
  { id: "u_maya", name: "Maya Chen", handle: "mayachen", hue: 214 },
  { id: "u_jonas", name: "Jonas Weber", handle: "jweber", hue: 152 },
  { id: "u_priya", name: "Priya Raman", handle: "priyar", hue: 18 },
  { id: "u_theo", name: "Theo Okafor", handle: "theo-ok", hue: 268 },
  { id: "u_lena", name: "Lena Park", handle: "lenapark", hue: 338 },
];

export const CURRENT_USER_ID = "u_maya";

export const WORKSPACES: Workspace[] = [
  { id: "ws_orbit", name: "Orbit Labs", slug: "orbit", initials: "O", plan: "Team" },
  { id: "ws_sandbox", name: "Maya's Sandbox", slug: "sandbox", initials: "M", plan: "Free" },
];

export const REPOSITORIES: Repository[] = [
  {
    id: "repo_orbit",
    workspaceId: "ws_orbit",
    owner: "orbit-labs",
    name: "orbit",
    fullName: "orbit-labs/orbit",
    defaultBranch: "main",
    private: true,
    description: "The Orbit web app and API",
    language: "TypeScript",
  },
  {
    id: "repo_orbit_mobile",
    workspaceId: "ws_orbit",
    owner: "orbit-labs",
    name: "orbit-mobile",
    fullName: "orbit-labs/orbit-mobile",
    defaultBranch: "main",
    private: true,
    description: "iOS and Android clients",
    language: "Swift",
  },
  {
    id: "repo_orbit_docs",
    workspaceId: "ws_orbit",
    owner: "orbit-labs",
    name: "orbit-docs",
    fullName: "orbit-labs/orbit-docs",
    defaultBranch: "main",
    private: false,
    description: "Public documentation site",
    language: "MDX",
  },
];

/** Repositories the simulated GitHub account can see but hasn't connected. */
export const AVAILABLE_REPOSITORIES: Omit<Repository, "id" | "workspaceId">[] = [
  { owner: "orbit-labs", name: "orbit", fullName: "orbit-labs/orbit", defaultBranch: "main", private: true, description: "The Orbit web app and API", language: "TypeScript" },
  { owner: "orbit-labs", name: "orbit-mobile", fullName: "orbit-labs/orbit-mobile", defaultBranch: "main", private: true, description: "iOS and Android clients", language: "Swift" },
  { owner: "orbit-labs", name: "orbit-docs", fullName: "orbit-labs/orbit-docs", defaultBranch: "main", private: false, description: "Public documentation site", language: "MDX" },
  { owner: "orbit-labs", name: "design-tokens", fullName: "orbit-labs/design-tokens", defaultBranch: "main", private: false, description: "Shared colour, type, and spacing tokens", language: "TypeScript" },
  { owner: "orbit-labs", name: "infra", fullName: "orbit-labs/infra", defaultBranch: "production", private: true, description: "Terraform and deploy pipelines", language: "HCL" },
];

function hash(str: string) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return ((h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")).repeat(3).slice(0, 40);
}

type Seed = Omit<ActivityItem, "sha" | "url" | "repoId"> & { repoId?: string };

function build(seed: Seed): ActivityItem {
  const repoId = seed.repoId ?? "repo_orbit";
  const repo = REPOSITORIES.find((r) => r.id === repoId)!;
  const sha = hash(seed.id);
  return {
    ...seed,
    repoId,
    sha,
    url:
      seed.type === "pull_request"
        ? `https://github.com/${repo.fullName}/pull/${seed.number}`
        : `https://github.com/${repo.fullName}/commit/${sha}`,
  };
}

const ago = (now: number, hours: number) => new Date(now - hours * 3_600_000).toISOString();

/** Activity that has already shipped in a published release (fixed dates). */
const PUBLISHED_ACTIVITY: Seed[] = [
  // Audit logs — Sep 1
  { id: "act_335", type: "pull_request", number: 335, title: "feat(security): add audit log for workspace admins", description: "Admins can review sign-ins, permission changes, and deletions from a new Audit log page.", authorId: "u_theo", createdAt: "2026-08-28T15:12:00Z", branch: "theo/audit-log", additions: 1240, deletions: 96 },
  { id: "act_c_audit_csv", type: "commit", title: "feat(security): export audit log as CSV", description: "Adds a streaming CSV export with date-range filters.", authorId: "u_theo", createdAt: "2026-08-30T10:41:00Z", branch: "main", additions: 210, deletions: 12 },
  // Billing — Sep 8
  { id: "act_348", type: "pull_request", number: 348, title: "feat(billing): improve billing settings", description: "The billing page now shows your plan, seats, and next invoice at a glance.", authorId: "u_lena", createdAt: "2026-09-03T09:20:00Z", branch: "lena/billing-v2", additions: 860, deletions: 540 },
  { id: "act_c_invoice_pdf", type: "commit", title: "feat(billing): download invoices as PDF", description: "Invoices can be downloaded individually or in bulk.", authorId: "u_lena", createdAt: "2026-09-04T13:02:00Z", branch: "main", additions: 188, deletions: 20 },
  { id: "act_351", type: "pull_request", number: 351, title: "fix(billing): show tax ID on invoices", description: "Tax IDs entered in settings now appear on every generated invoice.", authorId: "u_jonas", createdAt: "2026-09-06T16:45:00Z", branch: "jonas/invoice-tax-id", additions: 44, deletions: 8 },
  // Invitations — Sep 16
  { id: "act_360", type: "pull_request", number: 360, title: "feat(invites): improve invitation flow", description: "Invite several teammates at once and assign their role before they join.", authorId: "u_priya", createdAt: "2026-09-11T11:30:00Z", branch: "priya/invite-flow", additions: 720, deletions: 310 },
  { id: "act_c_resend", type: "commit", title: "feat(invites): resend and revoke pending invites", description: "Pending invitations can be resent or revoked from the members list.", authorId: "u_priya", createdAt: "2026-09-12T15:08:00Z", branch: "main", additions: 156, deletions: 34 },
  { id: "act_364", type: "pull_request", number: 364, title: "fix(invites): handle expired invitation links", description: "Expired links now explain what happened and let people request a new invite.", authorId: "u_jonas", createdAt: "2026-09-14T08:55:00Z", branch: "jonas/expired-invites", additions: 92, deletions: 15 },
  // Faster dashboard — Sep 24
  { id: "act_372", type: "pull_request", number: 372, title: "perf(dashboard): optimize dashboard loading", description: "Initial dashboard load drops from 2.4s to 0.6s at the 75th percentile.", authorId: "u_jonas", createdAt: "2026-09-19T10:14:00Z", branch: "jonas/dashboard-perf", additions: 430, deletions: 610 },
  { id: "act_c_stream", type: "commit", title: "perf(dashboard): stream project list", description: "Projects render progressively instead of waiting for the full list.", authorId: "u_jonas", createdAt: "2026-09-20T12:40:00Z", branch: "main", additions: 120, deletions: 64 },
  { id: "act_375", type: "pull_request", number: 375, title: "perf(api): cache workspace summary queries", description: "Workspace summaries are cached for 30 seconds and invalidated on write.", authorId: "u_theo", createdAt: "2026-09-21T17:22:00Z", branch: "theo/summary-cache", additions: 205, deletions: 18 },
  // Team workspaces — Oct 2
  { id: "act_388", type: "pull_request", number: 388, title: "feat(workspaces): introduce team workspaces", description: "Each team gets its own workspace with separate projects, members, and settings.", authorId: "u_maya", createdAt: "2026-09-26T09:05:00Z", branch: "maya/workspaces", additions: 2310, deletions: 420 },
  { id: "act_391", type: "pull_request", number: 391, title: "feat(workspaces): add workspace switcher to sidebar", description: "Switch between workspaces from the top of the sidebar or with ⌘O.", authorId: "u_lena", createdAt: "2026-09-28T14:18:00Z", branch: "lena/ws-switcher", additions: 380, deletions: 42 },
  { id: "act_c_migrate", type: "commit", title: "feat(workspaces): migrate existing projects to a default workspace", description: "Existing projects move into a default workspace with no action required.", authorId: "u_maya", createdAt: "2026-09-29T11:51:00Z", branch: "main", additions: 164, deletions: 9 },
  { id: "act_395", type: "pull_request", number: 395, title: "fix(workspaces): preserve last active workspace", description: "Orbit remembers the workspace you were in across sessions and devices.", authorId: "u_priya", createdAt: "2026-09-30T16:33:00Z", branch: "priya/last-workspace", additions: 58, deletions: 11 },
];

/** Unreleased activity, timestamped relative to when the demo was created. */
function unreleasedActivity(now: number): Seed[] {
  return [
    // Dark mode (draft release)
    { id: "act_412", type: "pull_request", number: 412, title: "feat(theme): support dark mode", description: "A full dark theme across the dashboard with refreshed surfaces and improved contrast.", authorId: "u_maya", createdAt: ago(now, 118), branch: "maya/dark-mode", additions: 1680, deletions: 390 },
    { id: "act_415", type: "pull_request", number: 415, title: "feat(theme): add theme toggle to user menu", description: "Choose light, dark, or match your system from the user menu.", authorId: "u_lena", createdAt: ago(now, 96), branch: "lena/theme-toggle", additions: 140, deletions: 12 },
    { id: "act_c_surfaces", type: "commit", title: "style(theme): refresh surface tokens for dark theme", description: "New elevation and border tokens so panels read clearly on dark backgrounds.", authorId: "u_maya", createdAt: ago(now, 90), branch: "main", additions: 96, deletions: 71 },
    { id: "act_418", type: "pull_request", number: 418, title: "fix(theme): improve contrast of muted text in dark theme", description: "Secondary text now meets WCAG AA contrast on every dark surface.", authorId: "u_priya", createdAt: ago(now, 70), branch: "priya/dark-contrast", additions: 38, deletions: 22 },
    // Mobile navigation (draft release)
    { id: "act_420", type: "pull_request", number: 420, title: "fix(nav): prevent sidebar overflow on mobile", description: "Long workspace and project names no longer push the sidebar off-screen on small devices.", authorId: "u_jonas", createdAt: ago(now, 52), branch: "jonas/mobile-sidebar", additions: 64, deletions: 30 },
    { id: "act_c_drawer", type: "commit", title: "fix(nav): close drawer on route change", description: "The mobile navigation drawer closes automatically after you pick a page.", authorId: "u_jonas", createdAt: ago(now, 49), branch: "main", additions: 18, deletions: 4 },
    // Command menu (suggestion)
    { id: "act_423", type: "pull_request", number: 423, title: "feat(search): add command menu with Cmd+K", description: "Jump to any project, teammate, or setting without leaving the keyboard.", authorId: "u_theo", createdAt: ago(now, 30), branch: "theo/command-menu", additions: 920, deletions: 55 },
    { id: "act_c_index", type: "commit", title: "feat(search): index projects and members", description: "Builds a client-side search index that updates in real time.", authorId: "u_theo", createdAt: ago(now, 27), branch: "main", additions: 240, deletions: 16 },
    // Notifications (suggestion)
    { id: "act_426", type: "pull_request", number: 426, title: "feat(notifications): batch email digests", description: "Group activity into a daily or weekly email digest instead of one email per event.", authorId: "u_lena", createdAt: ago(now, 14), branch: "lena/email-digests", additions: 610, deletions: 88 },
    { id: "act_c_debounce", type: "commit", title: "perf(notifications): debounce realtime badge updates", description: "Badge counts update at most once per second, reducing re-renders under load.", authorId: "u_priya", createdAt: ago(now, 9), branch: "main", additions: 34, deletions: 12 },
    // Ungrouped housekeeping
    { id: "act_c_deps", type: "commit", title: "chore(deps): bump next to 15.5", description: "Routine framework upgrade.", authorId: "u_theo", createdAt: ago(now, 6), branch: "main", additions: 12, deletions: 12 },
    { id: "act_c_docs", type: "commit", title: "docs: update contributing guide", description: "Clarifies the release checklist and branch naming.", authorId: "u_maya", createdAt: ago(now, 3), branch: "main", additions: 48, deletions: 20 },
    // Other repositories
    { id: "act_m_88", repoId: "repo_orbit_mobile", type: "pull_request", number: 88, title: "feat(theme): follow system appearance on iOS", description: "The iOS app now switches between light and dark with the system.", authorId: "u_lena", createdAt: ago(now, 40), branch: "lena/ios-appearance", additions: 210, deletions: 40 },
    { id: "act_m_c1", repoId: "repo_orbit_mobile", type: "commit", title: "fix(push): deliver notifications when app is backgrounded", description: "Fixes a regression in background push delivery on Android 15.", authorId: "u_jonas", createdAt: ago(now, 20), branch: "main", additions: 26, deletions: 9 },
    { id: "act_m_91", repoId: "repo_orbit_mobile", type: "pull_request", number: 91, title: "perf(sync): reduce cold start time", description: "Defers non-critical sync work until after the first screen renders.", authorId: "u_theo", createdAt: ago(now, 11), branch: "theo/cold-start", additions: 140, deletions: 102 },
    { id: "act_d_52", repoId: "repo_orbit_docs", type: "pull_request", number: 52, title: "docs(workspaces): add workspace administration guide", description: "New guide covering roles, invitations, and workspace settings.", authorId: "u_priya", createdAt: ago(now, 60), branch: "priya/ws-guide", additions: 380, deletions: 0 },
    { id: "act_d_c1", repoId: "repo_orbit_docs", type: "commit", title: "docs(api): document rate limits", description: "Adds a rate-limit reference with example headers.", authorId: "u_theo", createdAt: ago(now, 22), branch: "main", additions: 64, deletions: 2 },
  ];
}

/** Activity the simulated "Sync now" discovers, one batch per sync. */
export function pendingSyncActivity(now: number): ActivityItem[][] {
  return [
    [
      build({ id: "act_429", type: "pull_request", number: 429, title: "feat(search): show recent items in command menu", description: "The command menu opens with your recently visited projects.", authorId: "u_theo", createdAt: ago(now, 0.2), branch: "theo/recent-items", additions: 130, deletions: 14 }),
      build({ id: "act_c_hotkey", type: "commit", title: "fix(search): avoid hotkey conflict in text inputs", description: "⌘K no longer triggers while typing in code blocks.", authorId: "u_priya", createdAt: ago(now, 0.1), branch: "main", additions: 12, deletions: 3 }),
    ],
    [
      build({ id: "act_431", type: "pull_request", number: 431, title: "feat(notifications): add quiet hours", description: "Pause notifications outside your working hours.", authorId: "u_lena", createdAt: ago(now, 0.1), branch: "lena/quiet-hours", additions: 280, deletions: 22 }),
    ],
  ];
}

export function demoActivity(now: number): ActivityItem[] {
  return [...PUBLISHED_ACTIVITY, ...unreleasedActivity(now)].map(build);
}

let blk = 0;
const b = () => `seed_blk_${++blk}`;

export function demoReleases(now: number): Release[] {
  blk = 0;
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
  const today = new Date(now);
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  return [
    // ── Drafts ────────────────────────────────────────────────────────────
    {
      id: "rel_dark_mode",
      workspaceId: "ws_orbit",
      slug: "dark-mode-is-here",
      title: "Dark mode is here",
      summary: "A more comfortable interface for working at any hour.",
      category: "feature",
      status: "draft",
      version: "2.8",
      cover: { kind: "illustration", preset: "dashboard-dark", alt: "The Orbit dashboard in the new dark theme" },
      releaseDate: day(0),
      activityIds: ["act_412", "act_415", "act_c_surfaces", "act_418"],
      createdAt: minutesAgo(60 * 26),
      updatedAt: minutesAgo(12),
      blocks: [
        { id: b(), type: "paragraph", text: "We've introduced a dark theme across the Orbit dashboard, making it easier to work in low-light environments. The update includes improved contrast, refreshed surfaces, and more consistent styling across the main workspace." },
        { id: b(), type: "comparison", before: { kind: "illustration", preset: "dashboard-light", alt: "Dashboard in the light theme" }, after: { kind: "illustration", preset: "dashboard-dark", alt: "Dashboard in the dark theme" }, beforeLabel: "Light", afterLabel: "Dark", caption: "Drag to compare the light and dark themes." },
        { id: b(), type: "heading", text: "What's new" },
        { id: b(), type: "list", items: ["A full dark theme for every page in the dashboard.", "Choose light, dark, or match your system from the user menu.", "Secondary text now meets WCAG AA contrast on every dark surface."] },
        { id: b(), type: "pull_requests", activityIds: ["act_412", "act_415", "act_418"] },
      ],
    },
    {
      id: "rel_mobile_nav",
      workspaceId: "ws_orbit",
      slug: "smoother-navigation-on-mobile",
      title: "Smoother navigation on mobile",
      summary: "Navigation that behaves on every screen size.",
      category: "fix",
      status: "draft",
      cover: null,
      releaseDate: day(0),
      activityIds: ["act_420", "act_c_drawer"],
      createdAt: minutesAgo(60 * 20),
      updatedAt: minutesAgo(60 * 19),
      blocks: [
        { id: b(), type: "paragraph", text: "Long workspace and project names no longer push the sidebar off-screen on small devices, and the navigation drawer now closes as soon as you pick a page." },
        { id: b(), type: "pull_requests", activityIds: ["act_420"] },
      ],
    },
    // ── Published ─────────────────────────────────────────────────────────
    {
      id: "rel_workspaces",
      workspaceId: "ws_orbit",
      slug: "introducing-team-workspaces",
      title: "Introducing team workspaces",
      summary: "A dedicated space for every team, with its own projects, members, and settings.",
      category: "feature",
      status: "published",
      version: "2.7",
      cover: { kind: "illustration", preset: "workspaces", alt: "Workspace switcher open in the Orbit sidebar, listing three team workspaces" },
      releaseDate: "2026-10-02",
      publishedAt: "2026-10-02T16:00:00Z",
      createdAt: "2026-09-30T18:00:00Z",
      updatedAt: "2026-10-02T16:00:00Z",
      activityIds: ["act_388", "act_391", "act_c_migrate", "act_395"],
      blocks: [
        { id: b(), type: "paragraph", text: "As teams grow, a single shared space gets crowded. Workspaces give every team in your organisation its own home in Orbit — with separate projects, members, and settings — while keeping billing in one place." },
        { id: b(), type: "heading", text: "One organisation, many teams" },
        { id: b(), type: "paragraph", text: "Create a workspace for each team, then switch between them from the top of the sidebar or with ⌘O. Orbit remembers where you left off, across sessions and devices." },
        { id: b(), type: "video", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", title: "A two-minute tour of workspaces", caption: "Maya walks through creating and switching workspaces." },
        { id: b(), type: "heading", text: "What you need to do" },
        { id: b(), type: "list", items: ["Nothing — your existing projects have moved into a default workspace.", "Admins can create additional workspaces from Settings → Workspaces.", "Invite teammates to a specific workspace, or to your whole organisation."] },
        { id: b(), type: "link", url: "https://docs.orbit.example/workspaces", label: "Workspace administration guide", description: "Roles, invitations, and settings for workspace admins." },
        { id: b(), type: "pull_requests", activityIds: ["act_388", "act_391", "act_395"] },
      ],
    },
    {
      id: "rel_dashboard",
      workspaceId: "ws_orbit",
      slug: "a-faster-dashboard",
      title: "A faster dashboard",
      summary: "The dashboard now loads four times faster, so it's ready the moment you are.",
      category: "performance",
      status: "published",
      cover: null,
      releaseDate: "2026-09-24",
      publishedAt: "2026-09-24T15:30:00Z",
      createdAt: "2026-09-23T10:00:00Z",
      updatedAt: "2026-09-24T15:30:00Z",
      activityIds: ["act_372", "act_c_stream", "act_375"],
      blocks: [
        { id: b(), type: "paragraph", text: "The dashboard is the first thing you see every morning, so we made it fast. Initial load time drops from 2.4 seconds to 0.6 seconds for most workspaces." },
        { id: b(), type: "comparison", before: { kind: "illustration", preset: "dashboard-loading", alt: "Dashboard still showing loading placeholders after 2.4 seconds" }, after: { kind: "illustration", preset: "dashboard-fast", alt: "Dashboard fully loaded after 0.6 seconds" }, beforeLabel: "Before · 2.4s", afterLabel: "After · 0.6s", caption: "The same workspace, loaded on the same connection." },
        { id: b(), type: "heading", text: "How we did it" },
        { id: b(), type: "list", items: ["Projects now stream in progressively instead of waiting for the full list.", "Workspace summaries are cached and invalidated the moment something changes.", "We removed 180 KB of JavaScript from the dashboard's critical path."] },
        { id: b(), type: "pull_requests", activityIds: ["act_372", "act_375"] },
      ],
    },
    {
      id: "rel_invites",
      workspaceId: "ws_orbit",
      slug: "better-team-invitations",
      title: "Better team invitations",
      summary: "Getting teammates into Orbit, with less back-and-forth.",
      category: "improvement",
      status: "published",
      cover: { kind: "illustration", preset: "invites", alt: "Invite dialog with three email addresses and role selectors" },
      releaseDate: "2026-09-16",
      publishedAt: "2026-09-16T14:00:00Z",
      createdAt: "2026-09-15T09:00:00Z",
      updatedAt: "2026-09-16T14:00:00Z",
      activityIds: ["act_360", "act_c_resend", "act_364"],
      blocks: [
        { id: b(), type: "paragraph", text: "Invite several teammates at once and choose their role before they join. Pending invitations can now be resent or revoked from the members list." },
        { id: b(), type: "list", items: ["Paste a list of emails to invite everyone in one go.", "Assign Member, Admin, or Guest roles up front.", "Expired links explain what happened and let people request a fresh invite."] },
        { id: b(), type: "pull_requests", activityIds: ["act_360", "act_364"] },
      ],
    },
    {
      id: "rel_billing",
      workspaceId: "ws_orbit",
      slug: "improvements-to-billing",
      title: "Improvements to billing",
      summary: "Clearer plans, invoices, and payment details.",
      category: "improvement",
      status: "published",
      cover: { kind: "illustration", preset: "billing", alt: "Redesigned billing page showing plan, seats, and next invoice" },
      releaseDate: "2026-09-08",
      publishedAt: "2026-09-08T13:00:00Z",
      createdAt: "2026-09-07T11:00:00Z",
      updatedAt: "2026-09-08T13:00:00Z",
      activityIds: ["act_348", "act_c_invoice_pdf", "act_351"],
      blocks: [
        { id: b(), type: "paragraph", text: "The billing page now shows your plan, seats, and next invoice at a glance. Invoices can be downloaded as PDFs, and your tax ID appears on every one." },
        { id: b(), type: "pull_requests", activityIds: ["act_348", "act_351"] },
      ],
    },
    {
      id: "rel_audit",
      workspaceId: "ws_orbit",
      slug: "audit-logs-for-workspace-admins",
      title: "Audit logs for workspace admins",
      summary: "A complete record of who changed what, and when.",
      category: "security",
      status: "published",
      cover: null,
      releaseDate: "2026-09-01",
      publishedAt: "2026-09-01T12:00:00Z",
      createdAt: "2026-08-31T12:00:00Z",
      updatedAt: "2026-09-01T12:00:00Z",
      activityIds: ["act_335", "act_c_audit_csv"],
      blocks: [
        { id: b(), type: "paragraph", text: "Admins on the Team plan can now review sign-ins, permission changes, and deletions from a new Audit log page, and export any date range as CSV." },
        { id: b(), type: "pull_requests", activityIds: ["act_335"] },
      ],
    },
  ];
}

export const DEFAULT_APPEARANCE: Record<string, Appearance> = {
  ws_orbit: {
    productName: "Orbit",
    logo: null,
    description: "New features, improvements, and fixes — written by the team that builds Orbit.",
    accent: "#2856C5",
    theme: "dark",
    layout: "timeline",
    density: "comfortable",
    showFeatured: true,
    websiteUrl: "https://orbit.example",
  },
  ws_sandbox: {
    productName: "Sandbox",
    logo: null,
    description: "A place to try Shiplog.",
    accent: "#267447",
    theme: "light",
    layout: "timeline",
    density: "comfortable",
    showFeatured: true,
    websiteUrl: "",
  },
};

export function demoIntegrations(now: number): Record<string, Integration> {
  return {
    ws_orbit: {
      provider: "github",
      mode: "demo",
      status: "connected",
      account: "orbit-labs",
      connectedRepoIds: ["repo_orbit", "repo_orbit_mobile", "repo_orbit_docs"],
      lastSyncedAt: new Date(now - 4 * 60_000).toISOString(),
      lastError: null,
    },
    ws_sandbox: {
      provider: "github",
      mode: "demo",
      status: "disconnected",
      account: null,
      connectedRepoIds: [],
      lastSyncedAt: null,
      lastError: null,
    },
  };
}
