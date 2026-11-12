"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createNoteForAppointment } from "@/lib/notes";
import { NoteSchema, type Answer } from "@/lib/ai/note";

export type GenerateState = { error?: string };
export type SaveState = { error?: string; ok?: boolean; savedAt?: number };

function refresh(appointmentId: string) {
  revalidatePath(`/doctor/appointment/${appointmentId}`);
  revalidatePath("/doctor");
  revalidatePath("/admin");
}

export async function generateNoteAction(appointmentId: string): Promise<GenerateState> {
  await requireRole("doctor");
  const supabase = await createClient();

  // RLS: only the doctor of this appointment can read it and write its note.
  const { data } = await supabase
    .from("appointments")
    .select("reason, intake:intakes(answers)")
    .eq("id", appointmentId)
    .single();

  const appt = data as unknown as { reason: string | null; intake: { answers: Answer[] } | null } | null;
  if (!appt?.intake) return { error: "The patient has not sent answers yet." };

  const error = await createNoteForAppointment(supabase, appointmentId, appt.intake.answers, appt.reason);
  if (error) return { error };

  refresh(appointmentId);
  return {};
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

/** Saves the doctor's corrections to the AI note. */
export async function saveNote(appointmentId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireRole("doctor");
  const parsed = NoteSchema.safeParse({
    chief_complaint: String(formData.get("chief_complaint") ?? "").trim().slice(0, 500),
    history: String(formData.get("history") ?? "").trim().slice(0, 3000),
    medications: lines(formData.get("medications")),
    allergies: lines(formData.get("allergies")),
    red_flags: lines(formData.get("red_flags")),
    questions_for_doctor: lines(formData.get("questions_for_doctor")),
  });
  if (!parsed.success || !parsed.data.chief_complaint) return { error: "The chief complaint can't be empty." };

  const supabase = await createClient();
  // RLS + column grants: the doctor can change only content/edited_at of their own visit's note.
  const { error, count } = await supabase
    .from("notes")
    .update({ content: parsed.data, edited_at: new Date().toISOString() }, { count: "exact" })
    .eq("appointment_id", appointmentId);
  if (error || !count) return { error: "Could not save the note." };

  refresh(appointmentId);
  return { ok: true };
}

/** Saves the doctor's private notes (never shown to the patient). */
export async function saveDoctorNotes(appointmentId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireRole("doctor");
  const body = String(formData.get("body") ?? "").slice(0, 5000);
  const supabase = await createClient();
  const { error } = await supabase
    .from("doctor_notes")
    .upsert({ appointment_id: appointmentId, body, updated_at: new Date().toISOString() });
  if (error) return { error: "Could not save your notes." };

  revalidatePath(`/doctor/appointment/${appointmentId}`);
  return { ok: true, savedAt: Date.now() };
}

export async function setVisitStatus(appointmentId: string, status: "scheduled" | "completed"): Promise<void> {
  await requireRole("doctor");
  const supabase = await createClient();
  await supabase
    .from("appointments")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", appointmentId);
  refresh(appointmentId);
}

/** Recommendations for the patient; they see it with the visit once it is completed. */
export async function saveSummary(appointmentId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireRole("doctor");
  const body = String(formData.get("summary") ?? "").trim().slice(0, 3000);
  const supabase = await createClient();
  // RLS: only the doctor of this visit can write its summary.
  const { error } = body
    ? await supabase
        .from("visit_summaries")
        .upsert({ appointment_id: appointmentId, body, updated_at: new Date().toISOString() })
    : await supabase.from("visit_summaries").delete().eq("appointment_id", appointmentId);
  if (error) return { error: "Could not save the summary." };

  revalidatePath(`/doctor/appointment/${appointmentId}`);
  revalidatePath("/patient");
  return { ok: true, savedAt: Date.now() };
}
