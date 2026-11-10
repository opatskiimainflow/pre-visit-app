export type VisitState = {
  status?: string | null;
  note: unknown;
  intake: unknown;
};

/** One place that decides how a visit's progress is labelled. */
export function StatusChip({ visit }: { visit: VisitState }) {
  const [label, cls] =
    visit.status === "completed"
      ? ["Completed", "bg-ink text-white"]
      : visit.note
        ? ["Note ready", "bg-brand text-white"]
        : visit.intake
          ? ["Answers in", "bg-amber-100 text-amber-800"]
          : ["Waiting for patient", "bg-soft text-muted"];

  return <span className={`rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap ${cls}`}>{label}</span>;
}
