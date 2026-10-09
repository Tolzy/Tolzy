// Deterministic "story" engine. Turns raw repository activity into
// suggested groups and editable release narratives. In production this is
// where an LLM call would sit; the prototype uses rules so that output is
// predictable and always grounded in the selected activity.

import type {
  ActivityItem,
  Category,
  ReleaseContentBlock,
  SuggestedGroup,
} from "./types";
import { uid } from "./utils";

export interface ParsedTitle {
  type: string;
  scope: string | null;
  subject: string;
  breaking: boolean;
}

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

export function parseTitle(title: string): ParsedTitle {
  const m = title.match(CONVENTIONAL);
  if (!m) return { type: "other", scope: null, subject: title.trim(), breaking: false };
  return { type: m[1].toLowerCase(), scope: m[2]?.toLowerCase() ?? null, subject: m[4].trim(), breaking: !!m[3] };
}

interface Topic {
  noun: string; // "dark mode"
  /** Headline variants by category. `{noun}` is substituted. */
  headlines?: Partial<Record<Category, string[]>>;
  why: string; // the customer benefit, used in summaries
}

/** Known product areas. Unknown scopes fall back to a humanised scope. */
const TOPICS: Record<string, Topic> = {
  theme: {
    noun: "dark mode",
    headlines: {
      feature: ["Dark mode is here", "Introducing dark mode", "Orbit, after dark"],
      improvement: ["A more comfortable dark theme", "Dark mode, refined", "Better contrast in dark mode"],
    },
    why: "a more comfortable interface for working at any hour",
  },
  workspaces: {
    noun: "team workspaces",
    headlines: {
      feature: ["Introducing team workspaces", "Team workspaces are here", "One home for every team"],
      improvement: ["Better team workspaces", "Workspaces, refined", "Smoother workspace switching"],
    },
    why: "a dedicated space for every team, with its own projects, members, and settings",
  },
  nav: {
    noun: "mobile navigation",
    headlines: {
      fix: ["Smoother navigation on mobile", "Mobile navigation fixes", "Navigation that fits every screen"],
      improvement: ["Better navigation on mobile", "A tidier mobile sidebar", "Navigation, refined"],
    },
    why: "navigation that behaves on every screen size",
  },
  search: {
    noun: "the command menu",
    headlines: {
      feature: ["Meet the command menu", "Everything, one keystroke away", "Introducing the command menu"],
    },
    why: "a faster way to jump to any project, person, or action",
  },
  notifications: {
    noun: "notifications",
    headlines: {
      feature: ["Calmer, smarter notifications", "Introducing email digests", "Notifications, batched"],
      improvement: ["Quieter notifications", "Notifications, refined", "Fewer, better notifications"],
      performance: ["Snappier notification badges"],
    },
    why: "fewer interruptions without missing what matters",
  },
  dashboard: {
    noun: "the dashboard",
    headlines: {
      performance: ["A faster dashboard", "The dashboard, now much faster", "Less waiting, more doing"],
      improvement: ["A better dashboard", "Dashboard improvements"],
    },
    why: "a dashboard that is ready the moment you are",
  },
  api: { noun: "the API", why: "faster, more reliable responses everywhere in Orbit" },
  invites: {
    noun: "team invitations",
    headlines: {
      feature: ["Better team invitations", "Inviting your team, simplified", "A smoother way to invite"],
      improvement: ["Better team invitations", "Invitations, improved", "Inviting teammates, simplified"],
      fix: ["Invitation fixes"],
    },
    why: "getting teammates into Orbit with less back-and-forth",
  },
  billing: {
    noun: "billing",
    headlines: {
      feature: ["Improvements to billing", "Billing, made clearer", "A clearer billing page"],
      improvement: ["Improvements to billing", "Billing, made clearer", "A clearer billing page"],
    },
    why: "clearer plans, invoices, and payment details",
  },
  security: {
    noun: "audit logs",
    headlines: {
      security: ["Audit logs for workspace admins", "See every change with audit logs", "Introducing audit logs"],
      feature: ["Audit logs for workspace admins"],
    },
    why: "a complete record of who changed what, and when",
  },
  deps: { noun: "dependencies", why: "a more secure, up-to-date foundation" },
  docs: { noun: "documentation", why: "clearer guidance for contributors" },
};

const VERB_PAST: Record<string, string> = {
  add: "Added",
  introduce: "Introduced",
  support: "Added support for",
  fix: "Fixed",
  prevent: "Prevented",
  improve: "Improved",
  optimize: "Optimized",
  optimise: "Optimised",
  update: "Updated",
  remove: "Removed",
  refactor: "Refactored",
  refresh: "Refreshed",
  migrate: "Migrated",
  preserve: "Preserved",
  stream: "Streamed",
  cache: "Cached",
  handle: "Handled",
  show: "Showed",
  close: "Closed",
  batch: "Batched",
  debounce: "Debounced",
  index: "Indexed",
  bump: "Upgraded",
  resend: "Added resending for",
  download: "Added downloads for",
  export: "Added export for",
  enable: "Enabled",
  allow: "Allowed",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "prevent sidebar overflow on mobile" → "Prevented sidebar overflow on mobile" */
export function humanizeSubject(subject: string) {
  const [first, ...rest] = subject.split(" ");
  const past = VERB_PAST[first.toLowerCase()];
  const tail = rest.join(" ");
  if (past) return tail ? `${past} ${tail}` : past;
  return capitalize(subject);
}

/** Present-tense customer-facing phrasing: "You can now…" style bullets. */
function benefitBullet(subject: string) {
  const s = humanizeSubject(subject).replace(/\bwith Cmd\+K\b/i, "— press ⌘K anywhere");
  return s.endsWith(".") ? s : `${s}.`;
}

export function topicKey(item: ActivityItem) {
  const p = parseTitle(item.title);
  if (p.scope) return p.scope;
  // Keyword fallback for activity without a conventional scope.
  const t = item.title.toLowerCase();
  for (const key of Object.keys(TOPICS)) {
    if (t.includes(key) || t.includes(TOPICS[key].noun)) return key;
  }
  if (/dark|theme/.test(t)) return "theme";
  if (/sidebar|navigation|nav\b|mobile/.test(t)) return "nav";
  if (/invit/.test(t)) return "invites";
  return p.type;
}

function topicFor(key: string): Topic {
  return TOPICS[key] ?? { noun: key.replace(/[-_]/g, " "), why: `improvements to ${key.replace(/[-_]/g, " ")}` };
}

const TYPE_TO_CATEGORY: Record<string, Category> = {
  feat: "feature",
  fix: "fix",
  perf: "performance",
  security: "security",
  refactor: "improvement",
  style: "improvement",
  chore: "other",
  docs: "other",
  build: "other",
  ci: "other",
  test: "other",
};

export function inferCategory(items: ActivityItem[]): Category {
  if (items.length === 0) return "other";
  const parsed = items.map((i) => parseTitle(i.title));
  if (parsed.some((p) => p.scope === "security" || /security|vulnerab|cve/i.test(p.subject))) return "security";
  const counts = new Map<Category, number>();
  for (const p of parsed) {
    let c = TYPE_TO_CATEGORY[p.type] ?? "other";
    // "feat: improve x" is an improvement to an existing feature.
    if (c === "feature" && /^(improve|update|refresh|enhance)\b/i.test(p.subject)) c = "improvement";
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const order: Category[] = ["feature", "performance", "improvement", "fix", "security", "other"];
  let best: Category = "other";
  let bestN = -1;
  for (const c of order) {
    const n = counts.get(c) ?? 0;
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

function headlineFor(key: string, category: Category, variant: number) {
  const topic = topicFor(key);
  const list = topic.headlines?.[category] ?? Object.values(topic.headlines ?? {})[0];
  if (list && list.length) return list[variant % list.length];
  const noun = capitalize(topic.noun);
  const generic: Record<Category, string[]> = {
    feature: [`Introducing ${topic.noun}`, `${noun} is here`, `New: ${topic.noun}`],
    improvement: [`Better ${topic.noun}`, `${noun}, refined`, `Improvements to ${topic.noun}`],
    fix: [`Fixes for ${topic.noun}`, `${noun}, more reliable`, `Polish for ${topic.noun}`],
    performance: [`Faster ${topic.noun}`, `${noun}, now faster`, `Speed improvements to ${topic.noun}`],
    security: [`Security updates to ${topic.noun}`, `Hardening ${topic.noun}`, `${noun}, more secure`],
    other: [`Updates to ${topic.noun}`, `Maintenance: ${topic.noun}`, `Behind the scenes: ${topic.noun}`],
  };
  return generic[category][variant % 3];
}

function dominantKey(items: ActivityItem[]) {
  const counts = new Map<string, number>();
  for (const i of items) {
    const k = topicKey(i);
    counts.set(k, (counts.get(k) ?? 0) + (i.type === "pull_request" ? 2 : 1));
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";
}

/** Group unreleased activity into likely releases. */
export function suggestGroups(items: ActivityItem[]): SuggestedGroup[] {
  const byKey = new Map<string, ActivityItem[]>();
  for (const item of items) {
    const key = topicKey(item);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(item);
  }
  const groups: SuggestedGroup[] = [];
  for (const [key, group] of byKey) {
    const category = inferCategory(group);
    // Lone chores/docs make poor stories — leave them ungrouped.
    if (group.length < 2 && (category === "other" || !TOPICS[key])) continue;
    if (category === "other" && group.every((g) => ["chore", "docs", "ci", "build", "test"].includes(parseTitle(g.title).type))) continue;
    const prs = group.filter((g) => g.type === "pull_request").length;
    const commits = group.length - prs;
    const parts = [prs && `${prs} pull request${prs > 1 ? "s" : ""}`, commits && `${commits} commit${commits > 1 ? "s" : ""}`].filter(Boolean);
    groups.push({
      id: `group_${key}`,
      key,
      title: headlineFor(key, category, 0),
      category,
      activityIds: group.map((g) => g.id),
      rationale: `${parts.join(" and ")} touching ${topicFor(key).noun}`,
    });
  }
  return groups.sort((a, b) => b.activityIds.length - a.activityIds.length);
}

export interface GeneratedStory {
  title: string;
  summary: string;
  category: Category;
  blocks: ReleaseContentBlock[];
}

/**
 * Generate an editable release story from a selection. `variant` cycles
 * through alternative phrasings so "Regenerate" produces a real change.
 */
export function generateStory(items: ActivityItem[], variant = 0): GeneratedStory {
  if (items.length === 0) {
    return { title: "Untitled release", summary: "", category: "other", blocks: [] };
  }
  const key = dominantKey(items);
  const topic = topicFor(key);
  const category = inferCategory(items);
  const title = headlineFor(key, category, variant);
  const parsed = items.map((i) => ({ item: i, p: parseTitle(i.title) }));
  const features = parsed.filter((x) => x.p.type === "feat" || x.p.type === "style" || x.p.type === "refactor");
  const fixes = parsed.filter((x) => x.p.type === "fix");
  const perf = parsed.filter((x) => x.p.type === "perf");
  const authors = new Set(items.map((i) => i.authorId)).size;

  const summaries = [
    `${capitalize(topic.why)}.`,
    `We've been working on ${topic.noun}: ${topic.why}.`,
    `This update brings ${topic.why} — shaped by ${items.length} change${items.length > 1 ? "s" : ""} from the team.`,
  ];
  const summary = summaries[variant % summaries.length];

  const lead = items.find((i) => i.type === "pull_request" && i.description) ?? items[0];
  const intros: Record<Category, string> = {
    feature: `This update brings ${topic.why}. ${lead.description}`,
    improvement: `We've refined ${topic.noun} based on your feedback. ${lead.description}`,
    fix: `We've fixed several issues with ${topic.noun}. ${lead.description}`,
    performance: `We've made ${topic.noun} noticeably faster. ${lead.description}`,
    security: `We've strengthened ${topic.noun}. ${lead.description}`,
    other: `We've made some behind-the-scenes updates to ${topic.noun}. ${lead.description}`,
  };

  const blocks: ReleaseContentBlock[] = [{ id: uid("blk"), type: "paragraph", text: intros[category] }];

  const highlight = [...features, ...perf].map((x) => benefitBullet(x.p.subject));
  if (highlight.length) {
    blocks.push({ id: uid("blk"), type: "heading", text: variant % 2 ? "Highlights" : "What's new" });
    blocks.push({ id: uid("blk"), type: "list", items: highlight });
  }
  if (fixes.length) {
    blocks.push({ id: uid("blk"), type: "heading", text: "Fixes" });
    blocks.push({ id: uid("blk"), type: "list", items: fixes.map((x) => benefitBullet(x.p.subject)) });
  }
  const outros = [
    `Thanks to the ${authors > 1 ? `${authors} people` : "teammate"} who shipped this. Let us know what you think.`,
    `As always, we'd love to hear how this works for you.`,
    `More to come — reply to this update with any feedback.`,
  ];
  blocks.push({ id: uid("blk"), type: "paragraph", text: outros[variant % outros.length] });
  const prIds = items.filter((i) => i.type === "pull_request").map((i) => i.id);
  if (prIds.length) blocks.push({ id: uid("blk"), type: "pull_requests", activityIds: prIds });

  return { title, summary, category, blocks };
}
