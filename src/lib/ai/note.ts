import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DEMO_MODEL, generateDemoNote } from "./demo-note";

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
- Be concise and clinical. Write in English even if answers are in another language.
- red_flags: list only reported symptoms that may need prompt attention (e.g. chest pain, fainting,
  shortness of breath, frequent painkiller use, drug–allergy conflicts). If none, return an empty list.
- If an answer is missing or unclear, mention it in questions_for_doctor instead of guessing.`;

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Turns questionnaire answers into a structured note.
 * Only the answers and the visit reason are sent to the model — no names or contact details.
 */
export async function generateNote(answers: Answer[], reason: string | null): Promise<{ note: Note; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // No key → demo mode: a rule-based note, so the whole demo works for free.
  if (!apiKey) return { note: generateDemoNote(answers, reason), model: DEMO_MODEL };
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

  const client = new Anthropic({ apiKey });
  const questionnaire = answers.map((a, i) => `${i + 1}. ${a.question}\nAnswer: ${a.answer || "(no answer)"}`).join("\n\n");

  const message = await client.messages.parse({
    model,
    max_tokens: 1500,
    system: INSTRUCTIONS,
    messages: [
      { role: "user", content: `Reason for booking: ${reason ?? "not given"}\n\nQuestionnaire:\n${questionnaire}` },
    ],
    output_config: { format: zodOutputFormat(NoteSchema) },
  });

  if (!message.parsed_output) throw new Error("The model returned no note");
  return { note: message.parsed_output, model };
}
