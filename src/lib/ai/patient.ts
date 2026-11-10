/** Only age and sex reach the model — enough clinical context, no identifying data. */
export type PatientContext = { age: number | null; sex: "female" | "male" | null };

/** "45-year-old man", "Woman", or null when nothing is known. */
export function describePatient(p: PatientContext | null) {
  if (!p || (p.age === null && !p.sex)) return null;
  const who = p.sex === "female" ? "woman" : p.sex === "male" ? "man" : "patient";
  return p.age !== null ? `${p.age}-year-old ${who}` : who[0].toUpperCase() + who.slice(1);
}
