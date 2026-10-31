import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Studio } from "@/components/studio/studio";
import { StudioSkeleton } from "@/components/studio/studio-skeleton";
import { SAMPLE_FRAMING, SAMPLE_MODEL } from "@/lib/studio/sample-model";

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
  return (
    <Studio
      portraitName={SAMPLE_MODEL.name}
      projectName="Samples"
      modelUrl={SAMPLE_MODEL.url}
      framing={SAMPLE_FRAMING}
      thumbnailUrl={SAMPLE_MODEL.thumbnailUrl}
      isSample
    />
  );
}
