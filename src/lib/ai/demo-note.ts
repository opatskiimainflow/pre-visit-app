import type { Answer, Note } from "./note";
import { describePatient, type PatientContext } from "./patient";

/**
 * Demo mode: builds a pre-visit note with simple rules when no AI key is set.
 * Lets the whole demo work for free. Clearly labelled as "demo mode" in the UI.
 */
export const DEMO_MODEL = "demo-rules";

const NONE = /^(no|none|nope|n\/a|na|nothing|ні|немає|нет|-|—)\.?$/i;

function find(answers: Answer[], ...keywords: string[]) {
  const hit = answers.find((a) => keywords.some((k) => a.question.toLowerCase().includes(k)));
  return hit?.answer.trim() ?? "";
}

function splitList(text: string) {
  if (!text || NONE.test(text.trim())) return [];
  return text
    .split(/[,;\n]+|\band\b/i)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s && !NONE.test(s));
}

function sentence(text: string) {
  const t = text.trim();
  if (!t) return "";
  const s = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

const RED_FLAG_WORDS: [RegExp, string][] = [
  [/(?<!no |not |without )chest pain|біль у грудях/i, "Reports chest pain"],
  [/(?<!no |not |never )(faint|passed out)|непритом/i, "Reports fainting"],
  [/(?<!no |not |without )short(ness)? of breath|can'?t breathe|задиш/i, "Reports shortness of breath"],
  [/bleeding|blood in|coughing (up )?blood|vomiting blood|кровотеч/i, "Mentions bleeding or blood"],
  [/worst headache|sudden severe/i, "Sudden severe headache"],
  [/numb|weakness on one side|slurred/i, "Possible neurological symptoms"],
  [/suicid|self[- ]harm/i, "Mentions self-harm — needs prompt attention"],
];

export function generateDemoNote(answers: Answer[], reason: string | null, patient: PatientContext | null = null): Note {
  const complaint = find(answers, "main reason") || reason || "Not stated";
  const onset = find(answers, "when did it start");
  const chronic = find(answers, "chronic");
  const extra = find(answers, "anything else");
  const meds = splitList(find(answers, "medication"));
  const allergies = splitList(find(answers, "allerg"));
  const urgentYes = /^yes/i.test(find(answers, "chest pain", "shortness of breath", "fainting"));

  const allText = answers.map((a) => a.answer).join(" \n ");
  const redFlags = new Set<string>();
  if (urgentYes) redFlags.add("Answered YES to chest pain, shortness of breath or fainting");
  for (const [re, label] of RED_FLAG_WORDS) {
    if (re.test(allText)) redFlags.add(label);
  }
  const medsText = meds.join(" ").toLowerCase();
  if (/(ibuprofen|paracetamol|acetaminophen|aspirin|naproxen|ібупрофен|парацетамол)/.test(medsText) &&
      /(daily|every day|most days|щодня)/.test(allText.toLowerCase())) {
    redFlags.add("Frequent painkiller use");
  }
  if (allergies.some((a) => /penicillin|пеніцилін/i.test(a)) && /amoxicillin|амоксицилін/i.test(medsText)) {
    redFlags.add("Takes amoxicillin despite reported penicillin allergy");
  }

  const who = describePatient(patient);
  if (patient?.age !== null && patient?.age !== undefined && patient.age >= 65 && urgentYes) {
    redFlags.add("Age 65+ with reported chest pain, shortness of breath or fainting");
  }

  const history = [
    who && `${sentence(who)}`,
    onset && `Onset/course: ${sentence(onset)}`,
    chronic && !NONE.test(chronic) ? `Chronic conditions: ${sentence(chronic)}` : "No chronic conditions reported.",
    extra && !NONE.test(extra) ? sentence(extra) : "",
  ]
    .filter(Boolean)
    .join(" ");

  const questions = ["Severity on a 0–10 scale and what makes it better or worse?"];
  if (!onset) questions.unshift("When exactly did it start?");
  if (meds.length) questions.push("Any recent changes to medications or doses?");

  return {
    chief_complaint: sentence(complaint),
    history: history || "No further history provided.",
    medications: meds,
    allergies,
    red_flags: [...redFlags],
    questions_for_doctor: questions.slice(0, 3),
  };
}
