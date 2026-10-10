import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function uid(prefix = "id") {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "untitled"
  );
}

export function uniqueSlug(base: string, taken: Iterable<string>) {
  const set = new Set(taken);
  const root = slugify(base);
  if (!set.has(root)) return root;
  let i = 2;
  while (set.has(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now = Date.now()) {
  const t = new Date(iso).getTime();
  const diff = now - t;
  const abs = Math.abs(diff);
  const future = diff < 0;
  let out: string;
  // Small negative gaps are clock skew between "now" ticks, not the future.
  if (abs < 45_000 || (future && abs < 60_000)) return "just now";
  if (abs < HOUR) out = `${Math.round(abs / MINUTE)}m`;
  else if (abs < DAY) out = `${Math.round(abs / HOUR)}h`;
  else if (abs < 30 * DAY) out = `${Math.round(abs / DAY)}d`;
  else return formatDate(iso);
  return future ? `in ${out}` : `${out} ago`;
}

export function relativeTimeLong(iso: string, now = Date.now()) {
  const t = new Date(iso).getTime();
  const abs = Math.abs(now - t);
  const future = now - t < 0;
  const fmt = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  let out: string;
  if (abs < 45_000 || (future && abs < 60_000)) return "just now";
  if (abs < HOUR) out = fmt(Math.round(abs / MINUTE), "minute");
  else if (abs < DAY) out = fmt(Math.round(abs / HOUR), "hour");
  else if (abs < 30 * DAY) out = fmt(Math.round(abs / DAY), "day");
  else return `on ${formatDate(iso)}`;
  return future ? `in ${out}` : `${out} ago`;
}

/** Parse a yyyy-mm-dd string as a local date (avoids UTC off-by-one). */
export function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toDay(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parseDay(iso) : new Date(iso);
  return date.toLocaleDateString("en-US", opts);
}

export function formatDay(day: string, style: "long" | "short" | "parts" = "long") {
  const d = parseDay(day);
  if (style === "short") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function shortSha(sha: string) {
  return sha.slice(0, 7);
}

export function isSafeUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
