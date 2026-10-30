import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Studio } from "@/components/studio/studio";
import { StudioSkeleton } from "@/components/studio/studio-skeleton";

export const metadata: Metadata = { title: "Studio" };

/** Only the sample portrait exists until portraits are stored (Milestone 7). */
export function generateStaticParams() {
  return [{ portraitId: "sample" }];
}

export default function StudioPage({ params }: PageProps<"/studio/[portraitId]">) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <StudioForPortrait params={params} />
    </Suspense>
  );
}

async function StudioForPortrait({ params }: Pick<PageProps<"/studio/[portraitId]">, "params">) {
  const { portraitId } = await params;
  if (portraitId !== "sample") notFound();
  return <Studio portraitName="Sample head" projectName="Samples" isSample />;
}
