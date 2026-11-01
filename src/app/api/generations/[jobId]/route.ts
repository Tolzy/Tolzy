import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { getJob } from "@/lib/server/generation";
import { handle, noStore } from "@/lib/server/http";

/** Current job state; advances the job if a step is due (polling-driven pipeline). */
export function GET(_: Request, ctx: RouteContext<"/api/generations/[jobId]">) {
  return handle(async () => {
    const user = await requireUser();
    const { jobId } = await ctx.params;
    return NextResponse.json({ job: await getJob(user.id, jobId) }, { headers: noStore });
  });
}
