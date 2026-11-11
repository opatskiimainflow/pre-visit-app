"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, getProfile } from "@/lib/auth";
import { isDemoEmail } from "@/lib/demo";

export type ResetState = { error?: string };

export async function setNewPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };
  if (isDemoEmail(user.email)) return { error: "Demo accounts can't change their password." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Choose a password different from the old one."
          : error.code === "weak_password"
            ? "This password is too weak. Try a longer one."
            : "Could not update the password. Please request a new link.",
    };
  }
  const profile = await getProfile();
  redirect(profile ? `${ROLE_HOME[profile.role]}` : "/login");
}
