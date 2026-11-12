"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { kyivLocalToISO } from "@/lib/format";

export type BookState = { error?: string; ok?: boolean };

export async function bookAppointment(_prev: BookState, formData: FormData): Promise<BookState> {
  const profile = await requireRole("admin");
  const patientId = String(formData.get("patient_id") ?? "");
  const doctorId = String(formData.get("doctor_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200) || null;
  const scheduledAt = kyivLocalToISO(String(formData.get("date") ?? ""), String(formData.get("time") ?? ""));

  if (!patientId || !doctorId) return { error: "Choose a patient and a doctor." };
  if (!scheduledAt) return { error: "Choose a valid date and time." };
  if (new Date(scheduledAt).getTime() < Date.now() - 5 * 60_000) return { error: "That time is in the past." };

  const supabase = await createClient();
  const day = String(formData.get("date") ?? "");
  const { count: off } = await supabase
    .from("doctor_time_off")
    .select("id", { count: "exact", head: true })
    .eq("doctor_id", doctorId)
    .lte("start_date", day)
    .gte("end_date", day);
  if (off) return { error: "The doctor is off that day (see the Doctors tab)." };

  // RLS checks that both people belong to the admin's clinic.
  const { error } = await supabase.from("appointments").insert({
    clinic_id: profile.clinic_id,
    patient_id: patientId,
    doctor_id: doctorId,
    scheduled_at: scheduledAt,
    reason,
  });
  if (error) return { error: "Could not book the visit." };

  revalidatePath("/admin");
  revalidatePath("/doctor");
  return { ok: true };
}

export async function cancelAppointment(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  // RLS: only scheduled (not completed) visits of the admin's clinic can be cancelled.
  await supabase.from("appointments").delete().eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/doctor");
}
