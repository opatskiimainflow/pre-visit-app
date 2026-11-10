import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateNote, type Answer } from "@/lib/ai/note";

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
    const { note, model } = await generateNote(answers, reason);
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
