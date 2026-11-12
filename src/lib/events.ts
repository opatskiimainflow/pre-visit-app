import { formatDateTime } from "@/lib/format";

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

export const ACTIONS: Record<string, { label: string; dot: string }> = {
  booked: { label: "Booked", dot: "bg-brand" },
  rescheduled: { label: "Rescheduled", dot: "bg-amber-500" },
  cancelled: { label: "Cancelled", dot: "bg-red-500" },
  intake_submitted: { label: "Answers sent", dot: "bg-sky-500" },
  note_created: { label: "Note created", dot: "bg-violet-500" },
  note_edited: { label: "Note edited", dot: "bg-violet-500" },
  completed: { label: "Completed", dot: "bg-ink" },
  reopened: { label: "Reopened", dot: "bg-muted" },
  summary_shared: { label: "Summary", dot: "bg-emerald-600" },
  rated: { label: "Rated", dot: "bg-amber-400" },
  reminder_sent: { label: "Reminder", dot: "bg-sky-300" },
};

/**
 * One readable sentence that follows the actor's name, e.g.
 * "booked a visit for Olena Kovalenko with Dr. Andriy Melnyk on Thu 12 Nov, 10:00".
 * `withPatient` is false on a visit page, where the patient is already known.
 */
export function describeEvent(e: VisitEvent, withPatient = true) {
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

export const ROLE_LABEL: Record<string, string> = { admin: "Admin", doctor: "Doctor", patient: "Patient" };
