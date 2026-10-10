import { Suspense } from "react";
import { NewReleaseView } from "@/components/views/new-release";

export const metadata = { title: "New release" };

export default function Page() {
  return (
    <Suspense>
      <NewReleaseView />
    </Suspense>
  );
}
