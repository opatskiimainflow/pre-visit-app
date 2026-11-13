"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createNoteForAppointment } from "@/lib/notes";
import type { Answer } from "@/lib/ai/note";
import {
  QUESTION_SELECT,
  isCardField,
  questionText,
  visibleQuestions,
  type CardField,
  type Question,
} from "@/lib/medical-card";
import { getT } from "@/lib/i18n/server";

export type IntakeState = { error?: string; missing?: string[]; values?: Record<string, string> };

export async function submitIntake(
  appointmentId: string,
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const profile = await requireRole("patient");
  const supabase = await createClient();
  const { locale, t } = await getT();

  // RLS: the patient only sees their own appointment.
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, reason")
    .eq("id", appointmentId)
    .single();
  if (!appt) return { error: t.patient.errVisitNotFound };

  const { data: qs } = await supabase.from("questions").select(QUESTION_SELECT).order("position");
  const value = (id: string) => String(formData.get(id) ?? "").trim().slice(0, 2000);
  // Follow-ups count only after a "Yes" to their question; hidden ones are neither required nor saved.
  const questions = visibleQuestions((qs ?? []) as Question[], (id) => value(id) === "Yes");

  // Saved as the patient saw them: question in their language, "Yes"/"No" as the label they picked.
  const label = (q: Question) => {
    const v = value(q.id);
    if (q.kind !== "yes_no") return v;
    return v === "Yes" ? t.patient.yes : v === "No" ? t.patient.no : "";
  };
  const answers: Answer[] = questions.map((q) => ({ question: questionText(q, locale), answer: label(q) }));

  const missing = questions.filter((q, i) => q.required && !answers[i].answer).map((q) => q.id);
  if (missing.length) {
    // Send the answers back: React clears the form after an action, so the patient keeps them.
    return { error: t.patient.errRequired, missing, values: Object.fromEntries(questions.map((q) => [q.id, value(q.id)])) };
  }

  const { error } = await supabase
    .from("intakes")
    .insert({ appointment_id: appointmentId, answers });
  if (error && error.code !== "23505") {
    return { error: t.patient.errSendAnswers };
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
    await createNoteForAppointment(supabase, appointmentId, answers, appt.reason, locale);
  }

  redirect("/patient?sent=1");
}
