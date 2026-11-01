import "server-only";

import { NextResponse } from "next/server";
import { AuthError } from "./auth";
import { GenerationError } from "./generation";
import { UploadError } from "./photos";

/** JSON error responses with user-facing messages; never leaks internals. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof UploadError || e instanceof GenerationError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api]", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  });
}

export const noStore = { "Cache-Control": "private, no-store" };
