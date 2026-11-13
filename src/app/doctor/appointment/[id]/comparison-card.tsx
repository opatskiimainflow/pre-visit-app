import Link from "next/link";
import { hasChanges, type ListChange, type VisitComparison } from "@/lib/compare";
import { formatDateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";

function Changes({ label, c, d }: { label: string; c: ListChange; d: Messages["doctor"] }) {
  if (!hasChanges(c)) return null;
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-brand-dark uppercase">{label}</p>
      <ul className="mt-1 grid gap-1 text-sm">
        {c.added.map((x) => (
          <li key={`a${x}`} className="text-ink">
            <span className="mr-2 rounded bg-brand/10 px-1.5 py-0.5 text-xs font-semibold text-brand-dark">{d.tagNew}</span>
            {x}
          </li>
        ))}
        {c.changed.map((x) => (
          <li key={`c${x.to}`} className="text-ink">
            <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">{d.tagChanged}</span>
            {x.from} → {x.to}
          </li>
        ))}
        {c.removed.map((x) => (
          <li key={`r${x}`} className="text-muted">
            <span className="mr-2 rounded bg-soft px-1.5 py-0.5 text-xs font-semibold text-muted">{d.tagGone}</span>
            <s>{x}</s>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Since the last visit": what changed in medications, allergies and warning signs. */
export async function ComparisonCard({ previous, comparison }: { previous: { id: string; scheduled_at: string }; comparison: VisitComparison }) {
  const { locale, t } = await getT();
  const d = t.doctor;
  const any = hasChanges(comparison.medications) || hasChanges(comparison.allergies) || comparison.newRedFlags.length > 0;
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-ink">{d.sinceLast}</h2>
        <Link href={`/doctor/appointment/${previous.id}`} className="text-sm text-muted hover:text-brand">
          {formatDateTime(previous.scheduled_at, locale)} →
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        {d.lastTime} <span className="text-ink">{comparison.previousComplaint}</span>
      </p>
      <div className="mt-4 grid gap-4">
        {comparison.newRedFlags.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-wide text-red-700 uppercase">{d.newFlags}</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-red-900">
              {comparison.newRedFlags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        <Changes label={d.medications} c={comparison.medications} d={d} />
        <Changes label={d.allergies} c={comparison.allergies} d={d} />
        {!any && <p className="text-sm text-ink">{d.noDiff}</p>}
      </div>
    </div>
  );
}
