import type { Metadata } from "next";
import { Suspense } from "react";
import { GenerationScreen } from "@/components/create/generation-screen";

export const metadata: Metadata = { title: "Generating portrait" };

export default function GeneratePage({ params }: PageProps<"/generate/[jobId]">) {
  return (
    <Suspense fallback={<div className="bg-surface min-h-dvh" />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/generate/[jobId]">, "params">) {
  const { jobId } = await params;
  return <GenerationScreen jobId={jobId} />;
}
