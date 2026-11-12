import type { Note } from "@/lib/ai/note";

/** "Lisinopril 10 mg" → "lisinopril": the drug or allergen name without dose. */
function nameKey(item: string) {
  return item
    .toLowerCase()
    .replace(/\s[-—–]\s.*$|[—–(,].*$/, "")
    .replace(/\d.*$/, "")
    .replace(/[^\p{L}\s-]/gu, "")
    .trim();
}

/** Equal apart from case, spaces and punctuation ("Penicillin - rash" = "Penicillin — rash"). */
const same = (a: string, b: string) => {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return norm(a) === norm(b);
};

export type ListChange = { added: string[]; removed: string[]; changed: { from: string; to: string }[] };

/** What appeared, disappeared or changed (same name, different dose) between two lists. */
export function compareLists(before: string[], now: string[]): ListChange {
  const out: ListChange = { added: [], removed: [], changed: [] };
  const beforeByKey = new Map(before.map((b) => [nameKey(b), b]));
  const nowKeys = new Set(now.map(nameKey));
  for (const item of now) {
    const prev = beforeByKey.get(nameKey(item));
    if (prev === undefined) out.added.push(item);
    else if (!same(prev, item)) out.changed.push({ from: prev, to: item });
  }
  for (const item of before) if (!nowKeys.has(nameKey(item))) out.removed.push(item);
  return out;
}

export const hasChanges = (c: ListChange) => c.added.length + c.removed.length + c.changed.length > 0;

export type VisitComparison = {
  previousComplaint: string;
  medications: ListChange;
  allergies: ListChange;
  newRedFlags: string[];
};

/** Compares this visit's note with the previous visit's note. */
export function compareNotes(previous: Note, current: Note): VisitComparison {
  return {
    previousComplaint: previous.chief_complaint,
    medications: compareLists(previous.medications, current.medications),
    allergies: compareLists(previous.allergies, current.allergies),
    newRedFlags: current.red_flags.filter((f) => !previous.red_flags.some((p) => same(p, f))),
  };
}
