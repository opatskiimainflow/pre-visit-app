"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createNoteForAppointment } from "@/lib/notes";
import type { Answer } from "@/lib/ai/note";
import { QUESTION_SELECT, isCardField, visibleQuestions, type CardField, type Question } from "@/lib/medical-card";

export type IntakeState = { error?: string; missing?: string[]; values?: Record<string, string> };

export async function submitIntake(
  appointmentId: string,
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const profile = await requireRole("patient");
  const supabase = await createClient();

  // RLS: the patient only sees their own appointment.
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, reason")
    .eq("id", appointmentId)
    .single();
  if (!appt) return { error: "Visit not found." };

  const { data: qs } = await supabase.from("questions").select(QUESTION_SELECT).order("position");
  const value = (id: string) => String(formData.get(id) ?? "").trim().slice(0, 2000);
  // Follow-ups count only after a "Yes" to their question; hidden ones are neither required nor saved.
  const questions = visibleQuestions((qs ?? []) as Question[], (id) => value(id) === "Yes");

  const answers: Answer[] = questions.map((q) => ({ question: q.text, answer: value(q.id) }));

  const missing = questions.filter((q, i) => q.required && !answers[i].answer).map((q) => q.id);
  if (missing.length) {
    // Send the answers back: React clears the form after an action, so the patient keeps them.
    const values = Object.fromEntries(questions.map((q, i) => [q.id, answers[i].answer]));
    return { error: "Please answer the required questions.", missing, values };
  }

  const { error } = await supabase
    .from("intakes")
    .insert({ appointment_id: appointmentId, answers });
  if (error && error.code !== "23505") {
    return { error: "Could not send your answers. Please try again." };
  }

  // Keep the medical card up to date, so next time these answers are already filled in.
  if (!error && formData.get("save_card") === "on") {
    const card: Partial<Record<CardField, string>> = {};
    questions.forEach((q, i) => {
      if (isCardField(q.prefill) && answers[i].answer) card[q.prefill] = answers[i].answer.slice(0, 1000);
    });
    if (Object.keys(card).length) {
      await supabase
        .from("medical_cards")
        .upsert({ patient_id: profile.id, ...card, updated_at: new Date().toISOString() });
    }
  }

  // Best effort: if AI fails, the answers are saved and the doctor can generate the note later.
  if (!error) {
    await createNoteForAppointment(supabase, appointmentId, answers, appt.reason);
  }

  redirect("/patient?sent=1");
}
