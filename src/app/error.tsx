"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold tracking-[-0.01em]">Something went wrong</h1>
      <p className="text-muted mt-1.5 text-sm">The page couldn’t load. Your work is not affected.</p>
      <Button variant="secondary" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
