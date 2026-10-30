import type { Metadata } from "next";
import { Folder, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/display";
import { Tooltip } from "@/components/ui/tooltip";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <PageBody>
      <PageHeader
        title="Projects"
        description="Group related portraits — a team, a campaign, a client."
        actions={
          <Tooltip content="Sign in to create projects">
            <Button aria-disabled="true">
              <Plus />
              New project
            </Button>
          </Tooltip>
        }
      />
      <div className="border-line mt-10 rounded-xl border">
        <EmptyState
          icon={<Folder />}
          title="No projects yet"
          description="Portraits you create land in Unsorted. Create a project to keep related portraits together."
        />
      </div>
    </PageBody>
  );
}
