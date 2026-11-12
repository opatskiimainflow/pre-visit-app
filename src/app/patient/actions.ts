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

export type CardState = { error?: string; ok?: boolean };

export async function saveMedicalCard(_prev: CardState, formData: FormData): Promise<CardState> {
  const profile = await requireRole("patient");
  const read = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 1000);
  const supabase = await createClient();
  // RLS: a patient can write only their own card.
  const { error } = await supabase.from("medical_cards").upsert({
    patient_id: profile.id,
    allergies: read("allergies"),
    medications: read("medications"),
    conditions: read("conditions"),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save your medical card. Please try again." };

  revalidatePath("/patient");
  revalidatePath("/doctor", "layout");
  return { ok: true };
}

export type RateState = { error?: string; ok?: boolean };

export async function rateVisit(appointmentId: string, _prev: RateState, formData: FormData): Promise<RateState> {
  await requireRole("patient");
  const stars = Number(formData.get("stars"));
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: "Choose from 1 to 5 stars." };
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);

  const supabase = await createClient();
  // RLS: only the patient of a completed visit, and only once.
  const { error } = await supabase.from("visit_ratings").insert({ appointment_id: appointmentId, stars, comment });
  if (error) {
    return { error: error.code === "23505" ? "You have already rated this visit." : "Could not save your rating." };
  }

  revalidatePath("/patient");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
