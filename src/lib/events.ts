import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

export type VisitEvent = {
  id: number;
  appointment_id: string | null;
  actor_name: string;
  actor_role: string | null;
  action: string;
  patient_name: string | null;
  doctor_name: string | null;
  scheduled_at: string | null;
  details: { reason?: string | null; from?: string; to?: string; model?: string; stars?: number } | null;
  created_at: string;
};

export const EVENT_SELECT =
  "id, appointment_id, actor_name, actor_role, action, patient_name, doctor_name, scheduled_at, details, created_at";

/** Dot colour per action. Labels are in the i18n messages (events.labels). */
export const ACTIONS: Record<string, { dot: string }> = {
  booked: { dot: "bg-brand" },
  rescheduled: { dot: "bg-amber-500" },
  cancelled: { dot: "bg-red-500" },
  intake_submitted: { dot: "bg-sky-500" },
  note_created: { dot: "bg-violet-500" },
  note_edited: { dot: "bg-violet-500" },
  completed: { dot: "bg-ink" },
  reopened: { dot: "bg-muted" },
  summary_shared: { dot: "bg-emerald-600" },
  rated: { dot: "bg-amber-400" },
  reminder_sent: { dot: "bg-sky-300" },
};

/**
 * One readable sentence that follows the actor's name, e.g.
 * "booked a visit for Olena Kovalenko with Dr. Andriy Melnyk on Thu 12 Nov, 10:00".
 * `withPatient` is false on a visit page, where the patient is already known.
 */
export function describeEvent(e: VisitEvent, withPatient = true, locale: Locale = "en") {
  if (locale === "uk") return describeEventUk(e, withPatient);
  const self = e.actor_role === "patient" && e.actor_name === e.patient_name;
  const whose = self ? "their" : withPatient && e.patient_name ? `${e.patient_name}'s` : "the";
  const doc = e.doctor_name && withPatient ? ` with ${e.doctor_name}` : "";
  const when = e.scheduled_at ? formatDateTime(e.scheduled_at) : "";
  const at = (iso?: string) => (iso ? formatDateTime(iso) : "?");
  switch (e.action) {
    case "booked":
      return self || !withPatient
        ? `booked ${self ? "a" : "the"} visit${doc} for ${when}`
        : `booked a visit for ${e.patient_name}${doc} on ${when}`;
    case "rescheduled":
      return `moved ${whose} visit${doc} from ${at(e.details?.from)} to ${at(e.details?.to ?? e.scheduled_at ?? undefined)}`;
    case "cancelled":
      return `cancelled ${whose} visit${doc} on ${when}`;
    case "intake_submitted":
      return `sent the questionnaire answers for ${self ? "their" : "the"} visit on ${when}`;
    case "note_created": {
      const demo = e.details?.model?.startsWith("demo") ? " (demo mode)" : "";
      return e.actor_role === "patient"
        ? `submitted answers and the pre-visit note was generated${demo}`
        : `generated the pre-visit note${withPatient && e.patient_name ? ` for ${e.patient_name}` : ""}${demo}`;
    }
    case "note_edited":
      return `edited the pre-visit note${withPatient && e.patient_name ? ` for ${e.patient_name}` : ""}`;
    case "completed":
      return `completed the visit${withPatient && e.patient_name ? ` with ${e.patient_name}` : ""}`;
    case "reopened":
      return `reopened the visit${withPatient && e.patient_name ? ` with ${e.patient_name}` : ""}`;
    case "summary_shared":
      return `shared recommendations${withPatient && e.patient_name ? ` with ${e.patient_name}` : " with the patient"}`;
    case "rated": {
      const stars = e.details?.stars ? ` ${e.details.stars}★` : "";
      return `rated ${self ? "their" : "the"} visit${doc}${stars}`;
    }
    case "reminder_sent":
      return `emailed a questionnaire reminder${withPatient && e.patient_name ? ` to ${e.patient_name}` : ""} for ${when}`;
    default:
      return e.action;
  }
}

/**
 * Ukrainian: past-tense verbs carry gender ("записав/записала"), and the actor's gender is
 * unknown, so events read as noun phrases after a dash: "Ірина Бондар — запис на візит …".
 */
function describeEventUk(e: VisitEvent, withPatient: boolean) {
  const self = e.actor_role === "patient" && e.actor_name === e.patient_name;
  const who = withPatient && e.patient_name && !self ? ` (${e.patient_name})` : "";
  const doc = withPatient && e.doctor_name ? `, лікар ${e.doctor_name}` : "";
  const when = e.scheduled_at ? formatDateTime(e.scheduled_at, "uk") : "";
  const at = (iso?: string) => (iso ? formatDateTime(iso, "uk") : "?");
  switch (e.action) {
    case "booked":
      return `— запис на візит${who}${doc} на ${when}`;
    case "rescheduled":
      return `— перенесення візиту${who}${doc}: ${at(e.details?.from)} → ${at(e.details?.to ?? e.scheduled_at ?? undefined)}`;
    case "cancelled":
      return `— скасування візиту${who}${doc} на ${when}`;
    case "intake_submitted":
      return `— відповіді на анкету до візиту ${when}`;
    case "note_created": {
      const demo = e.details?.model?.startsWith("demo") ? " (демо-режим)" : "";
      return e.actor_role === "patient"
        ? `— відповіді надіслано, нотатку створено${demo}`
        : `— створення нотатки${who}${demo}`;
    }
    case "note_edited":
      return `— редагування нотатки${who}`;
    case "completed":
      return `— візит завершено${who}`;
    case "reopened":
      return `— візит повернуто в роботу${who}`;
    case "summary_shared":
      return `— рекомендації для пацієнта${who}`;
    case "rated": {
      const stars = e.details?.stars ? ` ${e.details.stars}★` : "";
      return `— оцінка візиту${doc}${stars}`;
    }
    case "reminder_sent":
      return `— нагадування про анкету${who} на ${when}`;
    default:
      return `— ${e.action}`;
  }
}
