import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs text-fg-faint">404</p>
      <h1 className="mt-3 font-serif text-4xl">This page doesn&apos;t exist</h1>
      <p className="mt-2 max-w-sm text-sm text-fg-subtle">The link may be broken, or the page may have moved.</p>
      <Link href="/app/overview" className="mt-6 inline-flex h-8 items-center rounded-md bg-invert px-3 text-sm font-medium text-invert-fg">
        Go to Shiplog
      </Link>
    </main>
  );
}
