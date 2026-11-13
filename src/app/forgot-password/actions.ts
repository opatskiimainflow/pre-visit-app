"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoEmail } from "@/lib/demo";
import { getT } from "@/lib/i18n/server";

export type ForgotState = { error?: string; sent?: boolean; email?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const { t } = await getT();
  if (!EMAIL.test(email)) return { email, error: t.auth.errEmail };
  if (isDemoEmail(email)) {
    return { email, error: t.auth.errDemoReset };
  }

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  // PKCE: the code verifier is stored in a cookie here and checked in /auth/callback,
  // so the link only works in the browser that asked for it.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
    return { email, error: t.auth.errTooManyEmails };
  }
  // Same answer whether or not the account exists, so the form can't be used to probe emails.
  return { email, sent: true };
}
