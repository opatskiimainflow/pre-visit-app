import { redirect } from "next/navigation";
import { getProfile, ROLE_HOME } from "@/lib/auth";

// The marketing site lives on Webflow; the app root just routes by role.
export default async function Home() {
  const profile = await getProfile();
  redirect(profile ? ROLE_HOME[profile.role] : "/login");
}
