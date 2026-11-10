"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type DetailsState = { error?: string; ok?: boolean };

export async function saveMyDetails(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  await requireRole("patient");
  const dob = String(formData.get("date_of_birth") ?? "").trim();
  const sex = String(formData.get("sex") ?? "").trim();

  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: "Enter a valid date of birth." };
  if (sex && sex !== "female" && sex !== "male") return { error: "Choose female or male." };

  const supabase = await createClient();
  // update_my_details() checks the role and the values again in the database.
  const { error } = await supabase.rpc("update_my_details", { p_dob: dob || null, p_sex: sex || null });
  if (error) return { error: error.code === "P0001" ? `${error.message}.` : "Could not save. Please try again." };

  revalidatePath("/patient");
  revalidatePath("/doctor", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
