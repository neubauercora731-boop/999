import { AppFrame, AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";

import { NewTaskForm } from "./new-task-form";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  await requireUser();

  return (
    <AppShell>
      <AppFrame className="py-8 sm:py-10">
        <NewTaskForm />
      </AppFrame>
    </AppShell>
  );
}
