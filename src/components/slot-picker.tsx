import Link from "next/link";
import { Empty } from "@/components/page-shell";
import { formatDay, formatTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

/**
 * Day chips + time grid shared by booking and rescheduling. Pure links (no client JS):
 * the chosen day/slot live in the URL. `hrefFor` builds the link for a day or a slot.
 */
export async function SlotPicker({
  days,
  slotsByDay,
  day,
  slot,
  hrefFor,
  doctorName,
  dayStep,
  timeStep,
}: {
  days: string[];
  slotsByDay: Map<string, string[]>;
  day: string | undefined;
  slot: string | undefined;
  hrefFor: (day: string, slot?: string) => string;
  doctorName: string;
  dayStep: string;
  timeStep: string;
}) {
  const slots = (day && slotsByDay.get(day)) || [];
  const { locale, t } = await getT();
  return (
    <>
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-brand-dark uppercase">{dayStep}</h2>
        {days.length === 0 ? (
          <Empty>{t.common.noWorkingDays(doctorName)}</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {days.map((d) => {
              const free = slotsByDay.get(d)?.length ?? 0;
              if (free === 0 && d !== day) {
                return (
                  <span
                    key={d}
                    className="rounded-full border border-dashed border-line px-4 py-2 text-sm text-muted/70"
                    title={t.common.noFreeTimes}
                  >
                    {formatDay(d, locale)} · {t.common.full}
                  </span>
                );
              }
              return (
                <Link
                  key={d}
                  href={hrefFor(d)}
                  aria-current={d === day ? "date" : undefined}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    d === day ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-brand"
                  }`}
                >
                  {formatDay(d, locale)}
                  <span className={d === day ? "ml-1.5 text-white/70" : "ml-1.5 text-muted"}>{free}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {day && (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-brand-dark uppercase">
            {timeStep} <span className="font-normal normal-case text-muted">({formatDay(day, locale)}, {t.common.clinicTime})</span>
          </h2>
          {slots.length === 0 ? (
            <Empty>{t.common.noTimesThisDay}</Empty>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {slots.map((s) => (
                <Link
                  key={s}
                  href={hrefFor(day, s)}
                  aria-current={s === slot ? "time" : undefined}
                  className={`rounded-xl border px-3 py-2.5 text-center font-semibold transition ${
                    s === slot ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-brand"
                  }`}
                >
                  {formatTime(s, locale)}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
