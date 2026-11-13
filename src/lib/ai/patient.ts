import { pluralUk, type Locale } from "@/lib/i18n/config";

/** Only age and sex reach the model — enough clinical context, no identifying data. */
export type PatientContext = { age: number | null; sex: "female" | "male" | null };

/** "45-year-old man" / "Чоловік, 45 років", "Woman" / "Жінка", or null when nothing is known. */
export function describePatient(p: PatientContext | null, locale: Locale = "en") {
  if (!p || (p.age === null && !p.sex)) return null;
  if (locale === "uk") {
    const who = p.sex === "female" ? "Жінка" : p.sex === "male" ? "Чоловік" : "Пацієнт";
    return p.age !== null ? `${who}, ${p.age} ${pluralUk(p.age, ["рік", "роки", "років"])}` : who;
  }
  const who = p.sex === "female" ? "woman" : p.sex === "male" ? "man" : "patient";
  return p.age !== null ? `${p.age}-year-old ${who}` : who[0].toUpperCase() + who.slice(1);
}
