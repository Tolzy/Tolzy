import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { handle, noStore } from "@/lib/server/http";
import { isSlot, storePhoto, UploadError } from "@/lib/server/photos";

/** Uploads one photo for a slot. Signed-in users only; validated and re-encoded server-side. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const form = await req.formData().catch(() => null);
    const slot = form?.get("slot");
    const file = form?.get("file");
    if (!isSlot(slot)) throw new UploadError("Unknown photo slot.");
    if (!(file instanceof File)) throw new UploadError("No file was sent.");
    const row = await storePhoto(user.id, slot, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(
      { photo: { id: row.id, slot: row.slot, width: row.width, height: row.height } },
      { headers: noStore },
    );
  });
}
