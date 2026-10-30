import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewPortraitTile, SamplePortraitTile } from "@/components/dashboard/portrait-tiles";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Portraits" };

const STEPS = [
  {
    title: "Upload a photo",
    body: "One clear, front-facing photo. Add side angles if you have them — they help the sides of the head.",
  },
  {
    title: "We build the head in 3D",
    body: "Face, hair, ears, the back of the head and the neck, reconstructed as real geometry.",
  },
  {
    title: "Style, export, embed",
    body: "Try studio materials and lighting, export GLB or PNG, or publish an interactive embed.",
  },
];

export default function DashboardPage() {
  return (
    <PageBody>
      <PageHeader
        title="Portraits"
        description="Private to you until you choose to publish."
        actions={
          <Button variant="primary" asChild>
            <Link href="/create">
              <Plus />
              New portrait
            </Link>
          </Button>
        }
      />

      <section aria-label="Your portraits" className="mt-10">
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <NewPortraitTile />
          <SamplePortraitTile />
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="border-line mt-16 border-t pt-8">
        <h2 id="how-it-works" className="text-muted text-xs font-medium">
          How it works
        </h2>
        <ol className="mt-5 grid gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="tabular text-muted font-mono text-xs leading-5">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-fg text-sm font-medium">{step.title}</h3>
                <p className="text-muted mt-1 text-sm">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </PageBody>
  );
}
