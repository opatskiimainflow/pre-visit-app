import { getT } from "@/lib/i18n/server";

export type VisitState = {
  status?: string | null;
  note: unknown;
  intake: unknown;
};

/** One place that decides how a visit's progress is labelled. */
export async function StatusChip({ visit }: { visit: VisitState }) {
  const s = (await getT()).t.doctor.status;
  const [label, cls] =
    visit.status === "completed"
      ? [s.completed, "bg-ink text-white"]
      : visit.note
        ? [s.note, "bg-brand text-white"]
        : visit.intake
          ? [s.answers, "bg-amber-100 text-amber-800"]
          : [s.waiting, "bg-soft text-muted"];

  return <span className={`rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap ${cls}`}>{label}</span>;
}
