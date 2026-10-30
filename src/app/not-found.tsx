import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shell/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <BrandMark />
      <h1 className="mt-6 text-lg font-semibold tracking-[-0.01em]">This page doesn’t exist</h1>
      <p className="text-muted mt-1.5 text-sm">It may have been moved, deleted, or never published.</p>
      <Button variant="secondary" className="mt-6" asChild>
        <Link href="/dashboard">Back to portraits</Link>
      </Button>
    </main>
  );
}
