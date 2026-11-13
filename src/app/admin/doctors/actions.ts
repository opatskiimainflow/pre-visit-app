"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, kyivDayStartISO, kyivToday, nowDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { dbMessage } from "@/lib/i18n/messages/db";
import type { Messages } from "@/lib/i18n/messages";

type Errors = Messages["admin"]["doctorErrors"];

export type DoctorFormState = { error?: string; ok?: boolean };

const SLOT_OPTIONS = [15, 20, 30, 45, 60];
const TIME = /^\d{2}:\d{2}$/;

type HoursRow = { weekday: number; start_time: string; end_time: string; slot_minutes: number };

/** Reads the 7-day schedule from the form: day_N (checkbox), start_N, end_N and one slot length. */
function readHours(formData: FormData, e: Errors): { rows: HoursRow[] } | { error: string } {
  const slot = Number(formData.get("slot"));
  if (!SLOT_OPTIONS.includes(slot)) return { error: e.slot };

  const rows: HoursRow[] = [];
  for (let day = 1; day <= 7; day++) {
    if (formData.get(`day_${day}`) !== "on") continue;
    const start = String(formData.get(`start_${day}`) ?? "");
    const end = String(formData.get(`end_${day}`) ?? "");
    if (!TIME.test(start) || !TIME.test(end) || end <= start) {
      return { error: e.hours };
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
  const { locale, t } = await getT();
  const e = t.admin.doctorErrors;
  const profile = readProfile(formData);
  const hours = readHours(formData, e);
  if ("error" in hours) return { error: hours.error };

  const supabase = await createClient();
  // add_doctor() checks the admin role, clinic and limits in the database.
  const { data: id, error } = await supabase.rpc("add_doctor", { p_name: profile.full_name, p_specialty: profile.specialty });
  if (error || !id) return { error: error?.code === "P0001" ? dbMessage(error.message, locale) : e.addFailed };

  if (hours.rows.length) {
    const { error: hoursError } = await supabase
      .from("doctor_hours")
      .insert(hours.rows.map((r) => ({ ...r, doctor_id: id as string })));
    if (hoursError) return { error: e.hoursAfterAdd };
  }

  refresh();
  return { ok: true };
}

export async function saveDoctor(doctorId: string, _prev: DoctorFormState, formData: FormData): Promise<DoctorFormState> {
  await requireRole("admin");
  const e = (await getT()).t.admin.doctorErrors;
  const profile = readProfile(formData);
  if (profile.full_name.length < 3) return { error: e.name };
  const hours = readHours(formData, e);
  if ("error" in hours) return { error: hours.error };

  const supabase = await createClient();
  // RLS: only doctors of the admin's own clinic; column grants: only name/specialty/active.
  const { error, count } = await supabase
    .from("profiles")
    .update(profile, { count: "exact" })
    .eq("id", doctorId)
    .eq("role", "doctor");
  if (error || !count) return { error: e.saveFailed };

  // Replace the weekly schedule. Existing appointments are never touched.
  const { error: delError } = await supabase.from("doctor_hours").delete().eq("doctor_id", doctorId);
  if (delError) return { error: e.hoursFailed };
  if (hours.rows.length) {
    const { error: insError } = await supabase
      .from("doctor_hours")
      .insert(hours.rows.map((r) => ({ ...r, doctor_id: doctorId })));
    if (insError) return { error: e.hoursFailed };
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

export type TimeOffState = { error?: string; ok?: boolean; warning?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Blocks whole days: patients can't book or move visits onto them. Booked visits stay. */
export async function addTimeOff(doctorId: string, _prev: TimeOffState, formData: FormData): Promise<TimeOffState> {
  await requireRole("admin");
  const start = String(formData.get("start_date") ?? "");
  const end = String(formData.get("end_date") ?? "") || start;
  const note = String(formData.get("note") ?? "").trim().slice(0, 120);
  const e = (await getT()).t.admin.doctorErrors;
  if (!DATE.test(start) || !DATE.test(end)) return { error: e.days };
  if (end < start) return { error: e.order };
  if (end < kyivToday(nowDate())) return { error: e.past };

  const supabase = await createClient();
  // RLS: admins only, and only for doctors of their own clinic.
  const { error } = await supabase.from("doctor_time_off").insert({ doctor_id: doctorId, start_date: start, end_date: end, note });
  if (error) return { error: e.timeOffFailed };

  // Visits booked before the time off was set are kept; tell the admin about them.
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("doctor_id", doctorId)
    .eq("status", "scheduled")
    .gte("scheduled_at", kyivDayStartISO(start))
    .lt("scheduled_at", kyivDayStartISO(addDays(end, 1)));

  refresh();
  revalidatePath("/doctor", "layout");
  return {
    ok: true,
    warning: count ? e.alreadyBooked(count) : undefined,
  };
}

export async function deleteTimeOff(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("doctor_time_off").delete().eq("id", id);
  refresh();
  revalidatePath("/doctor", "layout");
}
