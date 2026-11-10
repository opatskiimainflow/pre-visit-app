import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "patient" | "doctor" | "admin";

export type Profile = {
  id: string;
  clinic_id: string;
  role: Role;
  full_name: string;
};

export const ROLE_HOME: Record<Role, string> = {
  patient: "/patient",
  doctor: "/doctor",
  admin: "/admin",
};

/** Current user's profile, or null when signed out. Cached per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, full_name")
    .eq("id", user.id)
    .single();

  return (data as Profile | null) ?? null;
});

/** Use at the top of a protected page. Sends other roles to their own home. */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== role) redirect(ROLE_HOME[profile.role]);
  return profile;
}
