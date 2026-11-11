"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupState = { error?: string; email?: string; fullName?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const keep = { email, fullName };

  if (fullName.length < 2 || fullName.length > 80) return { ...keep, error: "Enter your full name." };
  if (!EMAIL.test(email)) return { ...keep, error: "Enter a valid email address." };
  if (password.length < 8) return { ...keep, error: "Use at least 8 characters for the password." };

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
        return { ...keep, error: "An account with this email already exists. Sign in instead." };
      case "weak_password":
        return { ...keep, error: "This password is too weak. Try a longer one." };
      case "over_request_rate_limit":
      case "over_email_send_rate_limit":
        return { ...keep, error: "Too many sign-ups right now. Please try again in a few minutes." };
      case "signup_disabled":
        return { ...keep, error: "Sign-ups are closed at the moment. Use a demo role instead." };
      default:
        return { ...keep, error: "Could not create the account. Please try again or use a demo role." };
    }
  }

  // Supabase returns a user without identities when the email is already taken
  // (it hides this on purpose); treat it the same as "already exists".
  if (data.user && data.user.identities?.length === 0) {
    return { ...keep, error: "An account with this email already exists. Sign in instead." };
  }
  if (!data.session) {
    // Only happens if "Confirm email" is switched back on in Supabase.
    return { ...keep, error: "Check your inbox to confirm your email, then sign in." };
  }

  redirect("/patient?welcome=1");
}
