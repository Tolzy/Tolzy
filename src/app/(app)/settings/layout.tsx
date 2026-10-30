import { PageBody, PageHeader } from "@/components/shell/page-header";
import { SettingsNav } from "@/components/shell/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <PageBody>
      <PageHeader title="Settings" />
      <div className="mt-8 flex flex-col gap-8 md:flex-row md:gap-12">
        <SettingsNav />
        <div className="min-w-0 flex-1 md:max-w-[680px]">{children}</div>
      </div>
    </PageBody>
  );
}
