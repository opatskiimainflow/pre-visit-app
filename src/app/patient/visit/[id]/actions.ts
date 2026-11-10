"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createNoteForAppointment } from "@/lib/notes";
import type { Answer } from "@/lib/ai/note";

export type IntakeState = { error?: string; missing?: string[] };

type Question = { id: string; text: string; kind: string; required: boolean };

export async function submitIntake(
  appointmentId: string,
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  await requireRole("patient");
  const supabase = await createClient();

  // RLS: the patient only sees their own appointment.
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, reason")
    .eq("id", appointmentId)
    .single();
  if (!appt) return { error: "Visit not found." };

  const { data: qs } = await supabase
    .from("questions")
    .select("id, text, kind, required")
    .order("position");
  const questions = (qs ?? []) as Question[];

  const answers: Answer[] = questions.map((q) => ({
    question: q.text,
    answer: String(formData.get(q.id) ?? "").trim().slice(0, 2000),
  }));

  const missing = questions.filter((q, i) => q.required && !answers[i].answer).map((q) => q.id);
  if (missing.length) {
    return { error: "Please answer the required questions.", missing };
  }

  const { error } = await supabase
    .from("intakes")
    .insert({ appointment_id: appointmentId, answers });
  if (error && error.code !== "23505") {
    return { error: "Could not send your answers. Please try again." };
  }

  // Best effort: if AI fails, the answers are saved and the doctor can generate the note later.
  if (!error) {
    await createNoteForAppointment(supabase, appointmentId, answers, appt.reason);
  }

  redirect("/patient?sent=1");
}
