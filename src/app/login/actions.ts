"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type Role } from "@/lib/auth";

export type LoginState = { error?: string };

const DEMO_EMAILS: Record<Role, string> = {
  patient: "patient@demo.previsit.app",
  doctor: "doctor@demo.previsit.app",
  admin: "admin@demo.previsit.app",
};

async function signInAndRedirect(email: string, password: string): Promise<LoginState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: "Wrong email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account has no PreVisit profile yet. Run supabase/seed.sql." };
  }

  redirect(ROLE_HOME[profile.role as Role]);
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  return signInAndRedirect(email, password);
}

export async function signInDemo(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const role = formData.get("role") as Role;
  const password = process.env.DEMO_PASSWORD;
  if (!DEMO_EMAILS[role] || !password) {
    return { error: "Demo login is not configured (DEMO_PASSWORD is missing)." };
  }
  return signInAndRedirect(DEMO_EMAILS[role], password);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
