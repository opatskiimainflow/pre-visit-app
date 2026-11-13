"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export type SignupState = { error?: string; email?: string; fullName?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const keep = { email, fullName };
  const { t } = await getT();

  if (fullName.length < 2 || fullName.length > 80) return { ...keep, error: t.auth.errFullName };
  if (!EMAIL.test(email)) return { ...keep, error: t.auth.errEmail };
  if (password.length < 8) return { ...keep, error: t.auth.errPasswordShort };

  const supabase = await createClient();
  // The database trigger (migrations/006) turns this into a patient of the demo clinic.
  // Role and clinic are decided there, not by anything sent from here.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, self_signup: true } },
  });

  if (error) {
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        return { ...keep, error: t.auth.errExists };
      case "weak_password":
        return { ...keep, error: t.auth.errWeak };
      case "over_request_rate_limit":
      case "over_email_send_rate_limit":
        return { ...keep, error: t.auth.errRate };
      case "signup_disabled":
        return { ...keep, error: t.auth.errClosed };
      default:
        return { ...keep, error: t.auth.errSignup };
    }
  }

  // Supabase returns a user without identities when the email is already taken
  // (it hides this on purpose); treat it the same as "already exists".
  if (data.user && data.user.identities?.length === 0) {
    return { ...keep, error: t.auth.errExists };
  }
  if (!data.session) {
    // Only happens if "Confirm email" is switched back on in Supabase.
    return { ...keep, error: t.auth.errConfirm };
  }

  redirect("/patient?welcome=1");
}
