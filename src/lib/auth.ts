import { redirect } from "next/navigation";

import { isMissingEnvironmentVariableError } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;

  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    if (isMissingEnvironmentVariableError(error)) {
      redirect("/auth?configuration=missing");
    }

    throw error;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  return {
    supabase,
    user,
  };
}
