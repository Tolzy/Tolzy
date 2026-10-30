import type { ReactNode } from "react";

/** Group of settings rows with a heading, separated by hairlines. */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-md text-fg font-medium">{title}</h2>
      {description && <p className="text-muted mt-1 text-sm">{description}</p>}
      <div className="divide-line border-line mt-4 divide-y border-y">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <div className="text-fg text-sm">{label}</div>
        {description && <p className="text-muted mt-0.5 text-xs">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

export function Notice({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-sunken text-muted ring-line mb-8 flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm ring-1 ring-inset [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
      {icon}
      <div>{children}</div>
    </div>
  );
}
