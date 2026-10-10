"use client";

import { ImageOff } from "lucide-react";
import { createContext, useContext, useState } from "react";
import type { MediaAsset, MediaPreset } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Product "screenshots" rendered in code. They scale with their container
 * (using container query units) and work without network access.
 */

interface Palette {
  bg: string;
  panel: string;
  side: string;
  line: string;
  ink: string;
  muted: string;
  faint: string;
}

const LIGHT: Palette = { bg: "#FAFAF8", panel: "#FFFFFF", side: "#F3F2EE", line: "#E7E5E0", ink: "#1C1C1A", muted: "#8A8984", faint: "#E9E7E2" };
const DARK: Palette = { bg: "#111111", panel: "#171717", side: "#0C0C0C", line: "#282828", ink: "#EDEDED", muted: "#7E7E7E", faint: "#242424" };

function Bar({ w, c, h = 1.1, className }: { w: string; c: string; h?: number; className?: string }) {
  return <span className={cn("block rounded-full", className)} style={{ width: w, height: `${h}cqw`, background: c }} />;
}

function Window({ p, children, accent }: { p: Palette; children: React.ReactNode; accent: string }) {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: p.bg, color: p.ink, ["--ill-accent" as string]: accent }}>
      <div className="flex shrink-0 items-center gap-[0.8cqw] px-[1.6cqw]" style={{ height: "4.2cqw", borderBottom: `1px solid ${p.line}`, background: p.side }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-full" style={{ width: "1cqw", height: "1cqw", background: p.line }} />
        ))}
        <span className="mx-auto rounded-[0.6cqw] px-[3cqw] py-[0.35cqw] text-[1.15cqw]" style={{ background: p.panel, color: p.muted, border: `1px solid ${p.line}` }}>
          app.orbit.example
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Side({ p, active = 0, accent, items = ["Home", "Projects", "Inbox", "Reports", "Members"] }: { p: Palette; active?: number; accent: string; items?: string[] }) {
  return (
    <div className="flex shrink-0 flex-col gap-[0.9cqw] p-[1.6cqw]" style={{ width: "20cqw", background: p.side, borderRight: `1px solid ${p.line}` }}>
      <div className="mb-[0.8cqw] flex items-center gap-[0.8cqw]">
        <span className="rounded-[0.5cqw]" style={{ width: "2.2cqw", height: "2.2cqw", background: accent }} />
        <span className="text-[1.35cqw] font-semibold">Orbit</span>
      </div>
      {items.map((label, i) => (
        <div
          key={label}
          className="flex items-center gap-[0.8cqw] rounded-[0.5cqw] px-[0.8cqw] py-[0.45cqw] text-[1.2cqw]"
          style={{ background: i === active ? p.panel : "transparent", color: i === active ? p.ink : p.muted, border: i === active ? `1px solid ${p.line}` : "1px solid transparent" }}
        >
          <span className="rounded-[0.3cqw]" style={{ width: "1.2cqw", height: "1.2cqw", background: i === active ? p.ink : p.line }} />
          {label}
        </div>
      ))}
    </div>
  );
}

function Stat({ p, label, value, loading }: { p: Palette; label: string; value: string; loading?: boolean }) {
  return (
    <div className="flex-1 rounded-[0.8cqw] p-[1.4cqw]" style={{ background: p.panel, border: `1px solid ${p.line}` }}>
      <div className="text-[1.05cqw]" style={{ color: p.muted }}>{label}</div>
      <div className="mt-[0.4cqw] flex h-[3.2cqw] items-center">
        {loading ? <Bar w="55%" c={p.faint} h={2.2} className="!rounded-[0.4cqw]" /> : <span className="text-[2.4cqw] font-semibold leading-none tracking-tight">{value}</span>}
      </div>
    </div>
  );
}

function Dashboard({ p, accent, loading, timer }: { p: Palette; accent: string; loading?: boolean; timer?: { label: string; tone: "slow" | "fast" } }) {
  const bars = [42, 58, 36, 70, 64, 82, 54, 90, 76, 96, 68, 88];
  return (
    <>
      <Side p={p} accent={accent} />
      <div className="flex min-w-0 flex-1 flex-col gap-[1.6cqw] p-[2.2cqw]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[1.1cqw]" style={{ color: p.muted }}>Good morning, Maya</div>
            <div className="text-[2cqw] font-semibold tracking-tight">Dashboard</div>
          </div>
          {timer && (
            <span
              className="rounded-full px-[1.2cqw] py-[0.4cqw] font-mono text-[1.2cqw] font-medium"
              style={{ background: timer.tone === "fast" ? "#267447" : "#946200", color: "#fff" }}
            >
              {timer.label}
            </span>
          )}
        </div>
        <div className="flex gap-[1.2cqw]">
          <Stat p={p} label="Active projects" value="24" loading={loading} />
          <Stat p={p} label="Open issues" value="138" loading={loading} />
          <Stat p={p} label="Shipped this week" value="17" loading={loading} />
        </div>
        <div className="flex min-h-0 flex-1 gap-[1.2cqw]">
          <div className="flex flex-[1.4] flex-col rounded-[0.8cqw] p-[1.4cqw]" style={{ background: p.panel, border: `1px solid ${p.line}` }}>
            <div className="text-[1.15cqw] font-medium">Throughput</div>
            <div className="mt-auto flex h-[60%] items-end gap-[0.7cqw]">
              {bars.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-t-[0.3cqw]"
                  style={{ height: loading ? "18%" : `${h}%`, background: loading ? p.faint : i === bars.length - 3 ? accent : p.line }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-[1cqw] rounded-[0.8cqw] p-[1.4cqw]" style={{ background: p.panel, border: `1px solid ${p.line}` }}>
            <div className="text-[1.15cqw] font-medium">Recent</div>
            {[78, 62, 70, 54].map((w, i) => (
              <div key={i} className="flex items-center gap-[0.8cqw]">
                <span className="rounded-full" style={{ width: "1.8cqw", height: "1.8cqw", background: loading ? p.faint : [accent, "#267447", "#946200", p.muted][i] }} />
                <Bar w={`${w}%`} c={loading ? p.faint : p.line} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Workspaces({ p, accent }: { p: Palette; accent: string }) {
  const teams = [
    { name: "Engineering", c: accent, n: "14 members" },
    { name: "Design", c: "#C2410C", n: "6 members" },
    { name: "Growth", c: "#267447", n: "9 members" },
  ];
  return (
    <>
      <Side p={p} accent={accent} active={1} />
      <div className="flex min-w-0 flex-1 flex-col gap-[1.4cqw] p-[2.2cqw]">
        <div className="text-[2cqw] font-semibold tracking-tight">Projects</div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-[1.2cqw] rounded-[0.6cqw] px-[1.2cqw] py-[1cqw]" style={{ background: p.panel, border: `1px solid ${p.line}` }}>
            <span className="rounded-[0.4cqw]" style={{ width: "1.8cqw", height: "1.8cqw", background: p.line }} />
            <Bar w={`${40 + ((i * 13) % 30)}%`} c={p.line} />
            <span className="ml-auto"><Bar w="6cqw" c={p.faint} /></span>
          </div>
        ))}
      </div>
      <div
        className="absolute flex flex-col gap-[0.4cqw] rounded-[1cqw] p-[0.8cqw]"
        style={{ left: "2.4cqw", top: "5.2cqw", width: "28cqw", background: p.panel, border: `1px solid ${p.line}`, boxShadow: "0 1.5cqw 4cqw -1cqw rgb(0 0 0 / 0.22)" }}
      >
        <div className="px-[0.8cqw] py-[0.4cqw] text-[1cqw] uppercase tracking-wider" style={{ color: p.muted }}>Workspaces</div>
        {teams.map((t, i) => (
          <div key={t.name} className="flex items-center gap-[1cqw] rounded-[0.6cqw] px-[0.8cqw] py-[0.7cqw]" style={{ background: i === 0 ? p.side : "transparent" }}>
            <span className="flex items-center justify-center rounded-[0.5cqw] text-[1.1cqw] font-semibold text-white" style={{ width: "2.6cqw", height: "2.6cqw", background: t.c }}>
              {t.name[0]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[1.3cqw] font-medium">{t.name}</div>
              <div className="text-[1cqw]" style={{ color: p.muted }}>{t.n}</div>
            </div>
            {i === 0 && <span className="text-[1.3cqw]" style={{ color: accent }}>✓</span>}
          </div>
        ))}
        <div className="mt-[0.2cqw] border-t px-[0.8cqw] pb-[0.3cqw] pt-[0.8cqw] text-[1.15cqw]" style={{ borderColor: p.line, color: p.muted }}>
          + New workspace
        </div>
      </div>
    </>
  );
}

function Invites({ p, accent }: { p: Palette; accent: string }) {
  const rows = [
    ["ana@orbit.example", "Admin"],
    ["sam@orbit.example", "Member"],
    ["kofi@orbit.example", "Guest"],
  ];
  return (
    <>
      <Side p={p} accent={accent} active={4} />
      <div className="relative flex-1" style={{ background: p.bg }}>
        <div className="absolute inset-0" style={{ background: "rgb(0 0 0 / 0.18)" }} />
        <div
          className="absolute left-1/2 top-1/2 flex w-[60%] -translate-x-1/2 -translate-y-1/2 flex-col gap-[1.2cqw] rounded-[1.2cqw] p-[2.2cqw]"
          style={{ background: p.panel, border: `1px solid ${p.line}`, boxShadow: "0 2cqw 5cqw -1cqw rgb(0 0 0 / 0.3)" }}
        >
          <div className="text-[1.8cqw] font-semibold tracking-tight">Invite teammates</div>
          {rows.map(([email, role]) => (
            <div key={email} className="flex items-center gap-[1cqw]">
              <div className="flex-1 rounded-[0.6cqw] px-[1cqw] py-[0.7cqw] text-[1.2cqw]" style={{ border: `1px solid ${p.line}` }}>{email}</div>
              <div className="rounded-[0.6cqw] px-[1cqw] py-[0.7cqw] text-[1.2cqw]" style={{ border: `1px solid ${p.line}`, color: p.muted }}>{role} ▾</div>
            </div>
          ))}
          <div className="mt-[0.4cqw] flex justify-end">
            <span className="rounded-[0.6cqw] px-[1.6cqw] py-[0.7cqw] text-[1.2cqw] font-medium text-white" style={{ background: accent }}>Send 3 invites</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Billing({ p, accent }: { p: Palette; accent: string }) {
  return (
    <>
      <Side p={p} accent={accent} active={3} items={["Home", "Projects", "Inbox", "Billing", "Members"]} />
      <div className="flex min-w-0 flex-1 flex-col gap-[1.4cqw] p-[2.2cqw]">
        <div className="text-[2cqw] font-semibold tracking-tight">Billing</div>
        <div className="flex gap-[1.2cqw]">
          <div className="flex-[1.3] rounded-[0.8cqw] p-[1.6cqw]" style={{ background: p.panel, border: `1px solid ${p.line}` }}>
            <div className="text-[1.05cqw]" style={{ color: p.muted }}>Current plan</div>
            <div className="mt-[0.3cqw] text-[2.2cqw] font-semibold">Team · Annual</div>
            <div className="mt-[1cqw] h-[0.8cqw] overflow-hidden rounded-full" style={{ background: p.faint }}>
              <div className="h-full w-[72%]" style={{ background: accent }} />
            </div>
            <div className="mt-[0.6cqw] text-[1.05cqw]" style={{ color: p.muted }}>29 of 40 seats used</div>
          </div>
          <div className="flex-1 rounded-[0.8cqw] p-[1.6cqw]" style={{ background: p.panel, border: `1px solid ${p.line}` }}>
            <div className="text-[1.05cqw]" style={{ color: p.muted }}>Next invoice</div>
            <div className="mt-[0.3cqw] text-[2.2cqw] font-semibold">$1,160</div>
            <div className="text-[1.05cqw]" style={{ color: p.muted }}>Due Oct 1</div>
          </div>
        </div>
        <div className="flex flex-1 flex-col rounded-[0.8cqw]" style={{ background: p.panel, border: `1px solid ${p.line}` }}>
          {["Sep 1 · $1,160", "Aug 1 · $1,120", "Jul 1 · $1,080"].map((row, i) => (
            <div key={row} className="flex items-center justify-between px-[1.6cqw] py-[1cqw] text-[1.2cqw]" style={{ borderTop: i ? `1px solid ${p.line}` : undefined }}>
              <span>{row}</span>
              <span style={{ color: accent }}>Download PDF</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Generic({ p, accent, title }: { p: Palette; accent: string; title: string }) {
  return (
    <>
      <Side p={p} accent={accent} />
      <div className="flex min-w-0 flex-1 flex-col gap-[1.2cqw] p-[2.2cqw]">
        <div className="text-[2cqw] font-semibold tracking-tight">{title}</div>
        {[70, 55, 82, 48, 64, 58].map((w, i) => (
          <div key={i} className="flex items-center gap-[1cqw] py-[0.6cqw]" style={{ borderBottom: `1px solid ${p.line}` }}>
            <span className="rounded-full" style={{ width: "1.6cqw", height: "1.6cqw", background: i === 0 ? accent : p.line }} />
            <Bar w={`${w}%`} c={p.line} />
          </div>
        ))}
      </div>
    </>
  );
}

// Fixed presets always render in their own palette (they illustrate a theme);
// the rest follow the surrounding page theme.
const PRESETS: Record<MediaPreset, (accent: string, p: Palette) => { p: Palette; body: React.ReactNode }> = {
  "dashboard-light": (a) => ({ p: LIGHT, body: <Dashboard p={LIGHT} accent={a} /> }),
  "dashboard-dark": (a) => ({ p: DARK, body: <Dashboard p={DARK} accent={a} /> }),
  "dashboard-loading": (a, p) => ({ p, body: <Dashboard p={p} accent={a} loading timer={{ label: "2.4s", tone: "slow" }} /> }),
  "dashboard-fast": (a, p) => ({ p, body: <Dashboard p={p} accent={a} timer={{ label: "0.6s", tone: "fast" }} /> }),
  workspaces: (a, p) => ({ p, body: <Workspaces p={p} accent={a} /> }),
  invites: (a, p) => ({ p, body: <Invites p={p} accent={a} /> }),
  billing: (a, p) => ({ p, body: <Billing p={p} accent={a} /> }),
  audit: (a, p) => ({ p, body: <Generic p={p} accent={a} title="Audit log" /> }),
  command: (a) => ({ p: DARK, body: <Generic p={DARK} accent={a} title="Command menu" /> }),
  "mobile-nav": (a, p) => ({ p, body: <Generic p={p} accent={a} title="Navigation" /> }),
};

/** Page theme that adaptive illustrations follow (set by the changelog frame). */
export const IllustrationTheme = createContext<"light" | "dark">("light");

export const PRESET_LABELS: Record<MediaPreset, string> = {
  "dashboard-light": "Dashboard · light",
  "dashboard-dark": "Dashboard · dark",
  "dashboard-loading": "Dashboard · loading",
  "dashboard-fast": "Dashboard · loaded",
  workspaces: "Workspace switcher",
  invites: "Invite dialog",
  billing: "Billing page",
  audit: "Audit log",
  command: "Command menu",
  "mobile-nav": "Navigation",
};

export function Illustration({ preset, accent = "#2856C5", label }: { preset: MediaPreset; accent?: string; label: string }) {
  const theme = useContext(IllustrationTheme);
  const { body, p } = PRESETS[preset](accent, theme === "dark" ? DARK : LIGHT);
  return (
    <div role="img" aria-label={label} className="@container relative aspect-[16/10] w-full select-none" style={{ background: p.bg }}>
      <Window p={p} accent={accent}>{body}</Window>
    </div>
  );
}

/** Renders any media asset, with a readable fallback if an image can't load. */
export function MediaView({ media, accent, className }: { media: MediaAsset; accent?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (media.kind === "illustration") {
    return (
      <div className={cn("overflow-hidden", className)}>
        <Illustration preset={media.preset} accent={accent} label={media.alt} />
      </div>
    );
  }
  if (failed) {
    return (
      <div className={cn("flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 p-6 text-center", className)} style={{ background: "color-mix(in srgb, currentColor 5%, transparent)" }}>
        <ImageOff className="size-5 opacity-50" aria-hidden />
        <p className="max-w-sm text-sm opacity-70">{media.alt || "Image unavailable"}</p>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.src} alt={media.alt} onError={() => setFailed(true)} loading="lazy" className={cn("block h-auto w-full object-cover", className)} />
  );
}
