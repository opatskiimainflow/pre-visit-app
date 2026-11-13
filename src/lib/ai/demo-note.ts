import type { Answer, Note } from "./note";
import type { Locale } from "@/lib/i18n/config";
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

/** Labels of the demo note in both UI languages. */
const L = {
  en: {
    notStated: "Not stated",
    urgentYes: "Answered YES to chest pain, shortness of breath or fainting",
    flags: [
      "Reports chest pain",
      "Reports fainting",
      "Reports shortness of breath",
      "Mentions bleeding or blood",
      "Sudden severe headache",
      "Possible neurological symptoms",
      "Mentions self-harm — needs prompt attention",
    ],
    painkillers: "Frequent painkiller use",
    amoxicillin: "Takes amoxicillin despite reported penicillin allergy",
    elderly: "Age 65+ with reported chest pain, shortness of breath or fainting",
    onset: "Onset/course:",
    chronic: "Chronic conditions:",
    noChronic: "No chronic conditions reported.",
    noHistory: "No further history provided.",
    qSeverity: "Severity on a 0–10 scale and what makes it better or worse?",
    qStart: "When exactly did it start?",
    qMeds: "Any recent changes to medications or doses?",
  },
  uk: {
    notStated: "Не вказано",
    urgentYes: "Відповів «Так» на питання про біль у грудях, задишку чи непритомність",
    flags: [
      "Повідомляє про біль у грудях",
      "Повідомляє про непритомність",
      "Повідомляє про задишку",
      "Згадує кровотечу або кров",
      "Раптовий сильний головний біль",
      "Можливі неврологічні симптоми",
      "Згадує самоушкодження — потрібна негайна увага",
    ],
    painkillers: "Часте вживання знеболювальних",
    amoxicillin: "Приймає амоксицилін попри алергію на пеніцилін",
    elderly: "Вік 65+ і біль у грудях, задишка чи непритомність",
    onset: "Початок і перебіг:",
    chronic: "Хронічні хвороби:",
    noChronic: "Хронічних хвороб не вказано.",
    noHistory: "Додаткового анамнезу немає.",
    qSeverity: "Наскільки сильно за шкалою 0–10 і що полегшує чи погіршує?",
    qStart: "Коли саме це почалося?",
    qMeds: "Чи змінювалися нещодавно ліки або дози?",
  },
};

const RED_FLAG_WORDS: RegExp[] = [
  /(?<!no |not |without )chest pain|біль у грудях/i,
  /(?<!no |not |never )(faint|passed out)|непритом/i,
  /(?<!no |not |without )short(ness)? of breath|can'?t breathe|задиш/i,
  /bleeding|blood in|coughing (up )?blood|vomiting blood|кровотеч|кров/i,
  /worst headache|sudden severe|раптов\S* сильн\S* (головн\S* )?біль/i,
  /numb|weakness on one side|slurred|оніміння|слабкість з одного боку/i,
  /suicid|self[- ]harm|самогубств|самоушкодж/i,
];

/** Questions are matched by keywords in English or Ukrainian. */
const KEY = {
  reason: ["main reason", "основна причина", "причина візиту"],
  onset: ["when did it start", "коли це почалося", "коли почалося"],
  chronic: ["chronic", "хронічн"],
  extra: ["anything else", "щось ще"],
  meds: ["medication", "ліки", "препарат"],
  allergies: ["allerg", "алергі"],
  urgent: ["chest pain", "shortness of breath", "fainting", "біль у грудях", "задишк", "непритом"],
};

export function generateDemoNote(
  answers: Answer[],
  reason: string | null,
  patient: PatientContext | null = null,
  locale: Locale = "en",
): Note {
  const l = L[locale];
  const complaint = find(answers, ...KEY.reason) || reason || l.notStated;
  const onset = find(answers, ...KEY.onset);
  const chronic = find(answers, ...KEY.chronic);
  const extra = find(answers, ...KEY.extra);
  const meds = splitList(find(answers, ...KEY.meds));
  const allergies = splitList(find(answers, ...KEY.allergies));
  const urgentYes = /^(yes|так)/i.test(find(answers, ...KEY.urgent));

  const allText = answers.map((a) => a.answer).join(" \n ");
  const redFlags = new Set<string>();
  if (urgentYes) redFlags.add(l.urgentYes);
  RED_FLAG_WORDS.forEach((re, i) => {
    if (re.test(allText)) redFlags.add(l.flags[i]);
  });
  const medsText = meds.join(" ").toLowerCase();
  if (/(ibuprofen|paracetamol|acetaminophen|aspirin|naproxen|ібупрофен|парацетамол)/.test(medsText) &&
      /(daily|every day|most days|щодня)/.test(allText.toLowerCase())) {
    redFlags.add(l.painkillers);
  }
  if (allergies.some((a) => /penicillin|пеніцилін/i.test(a)) && /amoxicillin|амоксицилін/i.test(medsText)) {
    redFlags.add(l.amoxicillin);
  }

  const who = describePatient(patient, locale);
  if (patient?.age !== null && patient?.age !== undefined && patient.age >= 65 && urgentYes) {
    redFlags.add(l.elderly);
  }

  const history = [
    who && `${sentence(who)}`,
    onset && `${l.onset} ${sentence(onset)}`,
    chronic && !NONE.test(chronic) ? `${l.chronic} ${sentence(chronic)}` : l.noChronic,
    extra && !NONE.test(extra) ? sentence(extra) : "",
  ]
    .filter(Boolean)
    .join(" ");

  const questions = [l.qSeverity];
  if (!onset) questions.unshift(l.qStart);
  if (meds.length) questions.push(l.qMeds);

  return {
    chief_complaint: sentence(complaint),
    history: history || l.noHistory,
    medications: meds,
    allergies,
    red_flags: [...redFlags],
    questions_for_doctor: questions.slice(0, 3),
  };
}
