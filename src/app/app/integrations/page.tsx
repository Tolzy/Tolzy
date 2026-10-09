import { Suspense } from "react";
import { IntegrationsView } from "@/components/views/integrations";

export const metadata = { title: "Integrations" };

export default function Page() {
  return (
    <Suspense>
      <IntegrationsView />
    </Suspense>
  );
}
