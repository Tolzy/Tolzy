import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-fg text-xl font-semibold tracking-[-0.015em]">{title}</h1>
        {description && <p className="text-muted mt-1.5 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Standard page gutter for content inside the app sheet. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1200px] px-5 pt-8 pb-16 md:px-10 md:pt-12">{children}</div>;
}
