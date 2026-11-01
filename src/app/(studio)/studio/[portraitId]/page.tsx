import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Studio } from "@/components/studio/studio";
import { StudioSkeleton } from "@/components/studio/studio-skeleton";
import { SAMPLE_FRAMING, SAMPLE_MODEL } from "@/lib/studio/sample-model";
import { currentUser } from "@/lib/server/auth";
import { getPortrait } from "@/lib/server/portraits";

export const metadata: Metadata = { title: "Studio" };

/** The sample is prerendered; generated portraits render on demand for their owner. */
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
  if (portraitId !== "sample") return <GeneratedStudio portraitId={portraitId} />;
  return (
    <Studio
      portraitId={portraitId}
      portraitName={SAMPLE_MODEL.name}
      projectName="Samples"
      modelUrl={SAMPLE_MODEL.url}
      framing={SAMPLE_FRAMING}
      thumbnailUrl={SAMPLE_MODEL.thumbnailUrl}
      isSample
    />
  );
}

/** A user's generated portrait: private, owner only; model streamed by an authenticated route. */
async function GeneratedStudio({ portraitId }: { portraitId: string }) {
  const user = await currentUser();
  const portrait = user ? await getPortrait(user.id, portraitId) : null;
  if (!portrait || portrait.status !== "ready" || !portrait.manifest) notFound();
  const m = portrait.manifest as { orientation: [number, number, number]; framing: { pivot: number; focus: number } };
  return (
    <Studio
      portraitId={portrait.id}
      portraitName={portrait.name}
      projectName="Portraits"
      modelUrl={`/api/portraits/${portrait.id}/model`}
      framing={{ orientation: m.orientation, pivot: m.framing.pivot, focus: m.framing.focus }}
      thumbnailUrl={portrait.hasThumbnail ? `/api/portraits/${portrait.id}/thumbnail` : undefined}
      badge={portrait.providerId === "fixture" ? "Fixture" : undefined}
    />
  );
}
