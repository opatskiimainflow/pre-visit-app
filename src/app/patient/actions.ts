"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { dbMessage } from "@/lib/i18n/messages/db";

export type DetailsState = { error?: string; ok?: boolean };

export async function saveMyDetails(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  await requireRole("patient");
  const dob = String(formData.get("date_of_birth") ?? "").trim();
  const sex = String(formData.get("sex") ?? "").trim();
  const { locale, t } = await getT();

  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: t.patient.errDob };
  if (sex && sex !== "female" && sex !== "male") return { error: t.patient.errSex };

  const supabase = await createClient();
  // update_my_details() checks the role and the values again in the database.
  const { error } = await supabase.rpc("update_my_details", { p_dob: dob || null, p_sex: sex || null });
  if (error) return { error: error.code === "P0001" ? dbMessage(error.message, locale) : t.patient.errSave };

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
  if (error) return { error: (await getT()).t.patient.errCard };

  revalidatePath("/patient");
  revalidatePath("/doctor", "layout");
  return { ok: true };
}

export type RateState = { error?: string; ok?: boolean };

export async function rateVisit(appointmentId: string, _prev: RateState, formData: FormData): Promise<RateState> {
  await requireRole("patient");
  const { t } = await getT();
  const stars = Number(formData.get("stars"));
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: t.patient.errStars };
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);

  const supabase = await createClient();
  // RLS: only the patient of a completed visit, and only once.
  const { error } = await supabase.from("visit_ratings").insert({ appointment_id: appointmentId, stars, comment });
  if (error) {
    return { error: error.code === "23505" ? t.patient.errRated : t.patient.errRating };
  }

  revalidatePath("/patient");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
