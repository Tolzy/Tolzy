import "server-only";

import { currentUser } from "@/lib/server/auth";
import { advanceJob } from "@/lib/server/generation";
import { listPortraits } from "@/lib/server/portraits";
import { PortraitCard } from "./portrait-tiles";

/**
 * The signed-in user's generated portraits (server component, private).
 * Jobs still generating are advanced first so their status is current.
 */
export async function UserPortraits() {
  const user = await currentUser();
  if (!user) return null;
  let portraits = await listPortraits(user.id);
  const generating = portraits.filter((p) => p.status === "generating");
  if (generating.length) {
    await Promise.all(generating.map((p) => advanceJob(p.jobId)));
    portraits = await listPortraits(user.id);
  }
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return portraits.map((p) => (
    <PortraitCard
      key={p.id}
      portrait={{
        id: p.id,
        name: p.name,
        status: p.status,
        meta: p.status === "generating" ? "Generating…" : `Created ${date.format(new Date(p.createdAt))}`,
        thumbnailUrl: p.hasThumbnail ? `/api/portraits/${p.id}/thumbnail` : undefined,
        href: p.status === "generating" ? `/generate/${p.jobId}` : `/studio/${p.id}`,
        badge: p.providerId === "fixture" ? "Fixture" : undefined,
      }}
    />
  ));
}
