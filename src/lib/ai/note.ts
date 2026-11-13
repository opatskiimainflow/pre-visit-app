import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DEMO_MODEL, generateDemoNote } from "./demo-note";
import { describePatient, type PatientContext } from "./patient";
import type { Locale } from "@/lib/i18n/config";

export type { PatientContext };

/** Structured pre-visit note. Same shape the doctor page renders. */
export const NoteSchema = z.object({
  chief_complaint: z.string().describe("One sentence: the main problem in the patient's words, made concise."),
  history: z.string().describe("2–4 sentences: onset, course, relevant chronic conditions and context."),
  medications: z.array(z.string()).describe("Each current medication with dose/frequency if given."),
  allergies: z.array(z.string()).describe("Each allergy with reaction if given. Empty if none reported."),
  red_flags: z
    .array(z.string())
    .describe("Reported symptoms or combinations that deserve prompt attention. Empty if none."),
  questions_for_doctor: z
    .array(z.string())
    .describe("2–3 short follow-up questions the doctor may want to ask."),
});

export type Note = z.infer<typeof NoteSchema>;
export type Answer = { question: string; answer: string };
const INSTRUCTIONS = `You prepare a pre-visit note for a doctor from a patient's questionnaire.
Rules:
- Use only what the patient reported. Never invent symptoms, doses or history.
- Do not diagnose and do not suggest treatment. You organize information; the doctor decides.
- Be concise and clinical. Write the note in the language named in the request, whatever language the answers are in.
- red_flags: list only reported symptoms that may need prompt attention (e.g. chest pain, fainting,
  shortness of breath, frequent painkiller use, drug–allergy conflicts). If none, return an empty list.
- If an answer is missing or unclear, mention it in questions_for_doctor instead of guessing.
- If the patient's age and sex are given, start history with them (e.g. "45-year-old man.") and take
  them into account for red_flags, but do not guess anything from them that the patient did not report.`;

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Turns questionnaire answers into a structured note.
 * Only the answers, the visit reason and the patient's age/sex are sent to the model —
 * no names, birth dates or contact details.
 */
export async function generateNote(
  answers: Answer[],
  reason: string | null,
  patient: PatientContext | null = null,
  locale: Locale = "en",
): Promise<{ note: Note; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // No key → demo mode: a rule-based note, so the whole demo works for free.
  if (!apiKey) return { note: generateDemoNote(answers, reason, patient, locale), model: DEMO_MODEL };
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

  const client = new Anthropic({ apiKey });
  const questionnaire = answers.map((a, i) => `${i + 1}. ${a.question}\nAnswer: ${a.answer || "(no answer)"}`).join("\n\n");

  const message = await client.messages.parse({
    model,
    max_tokens: 1500,
    system: INSTRUCTIONS,
    messages: [
      { role: "user", content: `Language of the note: ${locale === "uk" ? "Ukrainian" : "English"}\nPatient: ${describePatient(patient) ?? "age and sex not given"}\nReason for booking: ${reason ?? "not given"}\n\nQuestionnaire:\n${questionnaire}` },
    ],
    output_config: { format: zodOutputFormat(NoteSchema) },
  });

  if (!message.parsed_output) throw new Error("The model returned no note");
  return { note: message.parsed_output, model };
}
