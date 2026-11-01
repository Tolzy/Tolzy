import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { handle, noStore } from "@/lib/server/http";
import { deletePhotos, setKeepPhotos } from "@/lib/server/photos";
import { readDb } from "@/lib/server/store";

/** The signed-in user's stored photos and models (counts, sizes, retention) — no file data. */
export function GET() {
  return handle(async () => {
    const user = await requireUser();
    const db = await readDb();
    const photos = db.photos.filter((p) => p.ownerId === user.id);
    const models = db.assets.filter((a) => a.ownerId === user.id);
    return NextResponse.json(
      {
        models: { count: models.length, bytes: models.reduce((n, a) => n + a.bytes, 0) },
        count: photos.length,
        bytes: photos.reduce((n, p) => n + p.bytes, 0),
        keep: photos.length > 0 && photos.every((p) => p.keep),
        nextDeletion:
          photos
            .map((p) => p.deleteAfter)
            .filter(Boolean)
            .sort()[0] ?? null,
      },
      { headers: noStore },
    );
  });
}

/** Keep photos beyond the 30-day default, or go back to automatic deletion. */
export function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { keep } = (await req.json().catch(() => ({}))) as { keep?: boolean };
    await setKeepPhotos(user.id, keep === true);
    return NextResponse.json({ ok: true });
  });
}

/** Delete all source photos now (models are not affected). */
export function DELETE() {
  return handle(async () => {
    const user = await requireUser();
    const removed = await deletePhotos(user.id, "all");
    return NextResponse.json({ removed });
  });
}
