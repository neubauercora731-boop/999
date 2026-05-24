"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { toUserFriendlyErrorMessage } from "@/lib/utils";

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setSigningOut(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      router.replace("/auth");
      router.refresh();
    } catch (signOutError) {
      setError(toUserFriendlyErrorMessage(signOutError, "退出登录失败，请稍后重试。"));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button tone="secondary" onClick={signOut} disabled={signingOut}>
        {signingOut ? "退出中..." : "退出登录"}
      </Button>
      {error ? (
        <p className="max-w-xs text-right text-xs text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
