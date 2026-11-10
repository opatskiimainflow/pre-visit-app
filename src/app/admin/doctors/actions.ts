"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type DoctorFormState = { error?: string; ok?: boolean };

const SLOT_OPTIONS = [15, 20, 30, 45, 60];
const TIME = /^\d{2}:\d{2}$/;

type HoursRow = { weekday: number; start_time: string; end_time: string; slot_minutes: number };

/** Reads the 7-day schedule from the form: day_N (checkbox), start_N, end_N and one slot length. */
function readHours(formData: FormData): { rows: HoursRow[] } | { error: string } {
  const slot = Number(formData.get("slot"));
  if (!SLOT_OPTIONS.includes(slot)) return { error: "Choose a visit length." };

  const rows: HoursRow[] = [];
  for (let day = 1; day <= 7; day++) {
    if (formData.get(`day_${day}`) !== "on") continue;
    const start = String(formData.get(`start_${day}`) ?? "");
    const end = String(formData.get(`end_${day}`) ?? "");
    if (!TIME.test(start) || !TIME.test(end) || end <= start) {
      return { error: "Each working day needs an end time after its start time." };
    }
    rows.push({ weekday: day, start_time: start, end_time: end, slot_minutes: slot });
  }
  return { rows };
}

function readProfile(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? "").trim().slice(0, 80),
    specialty: String(formData.get("specialty") ?? "").trim().slice(0, 80) || null,
  };
}

function refresh() {
  revalidatePath("/admin/doctors");
  revalidatePath("/admin");
  revalidatePath("/patient/book");
}

export async function addDoctor(_prev: DoctorFormState, formData: FormData): Promise<DoctorFormState> {
  await requireRole("admin");
  const profile = readProfile(formData);
  const hours = readHours(formData);
  if ("error" in hours) return { error: hours.error };

  const supabase = await createClient();
  // add_doctor() checks the admin role, clinic and limits in the database.
  const { data: id, error } = await supabase.rpc("add_doctor", { p_name: profile.full_name, p_specialty: profile.specialty });
  if (error || !id) return { error: error?.code === "P0001" ? error.message : "Could not add the doctor." };

  if (hours.rows.length) {
    const { error: hoursError } = await supabase
      .from("doctor_hours")
      .insert(hours.rows.map((r) => ({ ...r, doctor_id: id as string })));
    if (hoursError) return { error: "Doctor added, but the working hours could not be saved." };
  }

  refresh();
  return { ok: true };
}

export async function saveDoctor(doctorId: string, _prev: DoctorFormState, formData: FormData): Promise<DoctorFormState> {
  await requireRole("admin");
  const profile = readProfile(formData);
  if (profile.full_name.length < 3) return { error: "Enter the doctor's full name." };
  const hours = readHours(formData);
  if ("error" in hours) return { error: hours.error };

  const supabase = await createClient();
  // RLS: only doctors of the admin's own clinic; column grants: only name/specialty/active.
  const { error, count } = await supabase
    .from("profiles")
    .update(profile, { count: "exact" })
    .eq("id", doctorId)
    .eq("role", "doctor");
  if (error || !count) return { error: "Could not save the doctor." };

  // Replace the weekly schedule. Existing appointments are never touched.
  const { error: delError } = await supabase.from("doctor_hours").delete().eq("doctor_id", doctorId);
  if (delError) return { error: "Could not update the working hours." };
  if (hours.rows.length) {
    const { error: insError } = await supabase
      .from("doctor_hours")
      .insert(hours.rows.map((r) => ({ ...r, doctor_id: doctorId })));
    if (insError) return { error: "Could not update the working hours." };
  }

  refresh();
  return { ok: true };
}

export async function setDoctorActive(doctorId: string, active: boolean): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("profiles").update({ active }).eq("id", doctorId).eq("role", "doctor");
  refresh();
}
