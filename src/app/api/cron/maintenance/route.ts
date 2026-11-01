import { NextResponse } from "next/server";
import { advanceAllJobs } from "@/lib/server/generation";
import { purgeExpiredPhotos } from "@/lib/server/photos";

/**
 * Scheduled maintenance (Vercel Cron in production): finishes jobs nobody is
 * watching and deletes source photos past their retention date.
 * Requires `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const jobs = await advanceAllJobs();
  const photosDeleted = await purgeExpiredPhotos();
  return NextResponse.json({ jobs, photosDeleted });
}
