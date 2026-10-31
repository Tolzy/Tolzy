import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PreviewRender } from "./preview-render";

export const metadata: Metadata = { title: "Preview renders", robots: { index: false } };

/**
 * Development-only: renders one preset preview with the studio's real viewer,
 * material system and light rigs. scripts/render-previews.mjs captures these
 * into public/previews/.
 */
export default function PreviewRendersPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <PreviewRender />
    </Suspense>
  );
}
