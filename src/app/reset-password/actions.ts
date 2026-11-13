"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, getProfile } from "@/lib/auth";
import { isDemoEmail } from "@/lib/demo";
import { getT } from "@/lib/i18n/server";

export type ResetState = { error?: string };

export async function setNewPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const { t } = await getT();
  if (password.length < 8) return { error: t.auth.errMin8 };
  if (password !== confirm) return { error: t.auth.errMismatch };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t.auth.errResetExpired };
  if (isDemoEmail(user.email)) return { error: t.auth.errDemoChange };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? t.auth.errSamePassword
          : error.code === "weak_password"
            ? t.auth.errWeak
            : t.auth.errUpdate,
    };
  }
  const profile = await getProfile();
  redirect(profile ? `${ROLE_HOME[profile.role]}` : "/login");
}
