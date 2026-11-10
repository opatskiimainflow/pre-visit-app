"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the Supabase session alive without proxy.ts (which runs on the
 * Node.js runtime and is still experimental on Cloudflare Workers).
 * The browser client refreshes the token and writes the new cookies;
 * we then re-render server components with the fresh session.
 */
export function SessionRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return null;
}
