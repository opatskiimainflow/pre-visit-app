import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateNote, type Answer, type PatientContext } from "@/lib/ai/note";
import { ageFrom, nowDate } from "@/lib/format";

/**
 * Generates the AI note for an appointment that already has answers and saves it.
 * Runs with the caller's Supabase session, so RLS decides whether they may write it.
 * Returns an error message instead of throwing, so callers can show it.
 */
export async function createNoteForAppointment(
  supabase: SupabaseClient,
  appointmentId: string,
  answers: Answer[],
  reason: string | null,
): Promise<string | null> {
  try {
    const { data: appt } = await supabase
      .from("appointments")
      .select("patient:profiles!appointments_patient_id_fkey(date_of_birth, sex)")
      .eq("id", appointmentId)
      .single();
    const p = (appt?.patient ?? null) as unknown as { date_of_birth: string | null; sex: string | null } | null;
    const patient: PatientContext | null = p
      ? {
          age: p.date_of_birth ? ageFrom(p.date_of_birth, nowDate()) : null,
          sex: p.sex === "female" || p.sex === "male" ? p.sex : null,
        }
      : null;

    const { note, model } = await generateNote(answers, reason, patient);
    const { error } = await supabase
      .from("notes")
      .insert({ appointment_id: appointmentId, content: note, model });
    if (error) {
      // 23505 = unique violation: a note already exists, which is fine.
      return error.code === "23505" ? null : `Could not save the note: ${error.message}`;
    }
    return null;
  } catch (e) {
    console.error("AI note generation failed", e);
    return "The AI note could not be generated. Please try again.";
  }
}
