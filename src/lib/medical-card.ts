/** The patient's medical card: kept between visits, pre-fills the questionnaire. */
export type MedicalCard = { allergies: string; medications: string; conditions: string; updated_at?: string };

/** Labels and placeholders are in the i18n messages (patient.cardFields). */
export const CARD_FIELDS = [{ key: "allergies" }, { key: "medications" }, { key: "conditions" }] as const;

export type CardField = (typeof CARD_FIELDS)[number]["key"];

export const isCardField = (v: unknown): v is CardField =>
  v === "allergies" || v === "medications" || v === "conditions";

export type Question = {
  id: string;
  text: string;
  /** Ukrainian wording set by the clinic admin (migrations/009); falls back to `text`. */
  text_uk: string | null;
  kind: string;
  required: boolean;
  parent_id: string | null;
  prefill: string | null;
};

export const QUESTION_SELECT = "id, text, text_uk, kind, required, parent_id, prefill";

/** The question in the patient's UI language, as the clinic wrote it. */
export function questionText(q: { text: string; text_uk?: string | null }, locale: "en" | "uk") {
  return locale === "uk" && q.text_uk?.trim() ? q.text_uk : q.text;
}

/**
 * Which questions count for a set of answers: a follow-up only when its parent was answered "Yes".
 * Used by the form (to show/hide) and by the server (to validate and save).
 */
export function visibleQuestions(questions: Question[], yes: (id: string) => boolean) {
  const ids = new Set(questions.map((q) => q.id));
  return orderQuestions(questions).filter((q) => !q.parent_id || !ids.has(q.parent_id) || yes(q.parent_id));
}

/**
 * Display order: top-level questions by position, each followed by its own follow-ups.
 * Expects the list already sorted by position.
 */
export function orderQuestions<T extends { id: string; parent_id: string | null }>(questions: T[]): T[] {
  const ids = new Set(questions.map((q) => q.id));
  const out: T[] = [];
  for (const q of questions) {
    // A follow-up whose parent is gone is shown as a regular question.
    if (q.parent_id && ids.has(q.parent_id)) continue;
    out.push(q, ...questions.filter((c) => c.parent_id === q.id));
  }
  return out;
}
