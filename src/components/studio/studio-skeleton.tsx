/** Static frame shown while a portrait loads. Mirrors the studio layout. */
export function StudioSkeleton() {
  return (
    <div className="bg-bg flex h-dvh flex-col" aria-busy="true" aria-label="Loading studio">
      <div className="border-line bg-surface flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <span className="bg-sunken size-8 rounded-md" />
        <span className="bg-sunken h-3 w-40 rounded-sm" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="h-[46dvh] shrink-0 bg-[radial-gradient(120%_90%_at_50%_38%,#1f1f23_0%,#0b0b0c_100%)] md:h-auto md:flex-1" />
        <div className="bg-surface md:border-line flex-1 md:w-[352px] md:flex-none md:border-l" />
      </div>
    </div>
  );
}
