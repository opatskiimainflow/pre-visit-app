import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDay,
  formatTime,
  formatWeekRange,
  kyivDayOf,
  kyivDayStartISO,
  kyivToday,
  nowDate,
  weekStart,
} from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { DoctorTabs } from "../doctor-tabs";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.doctor.calendarTitle };
}

type Visit = {
  id: string;
  scheduled_at: string;
  status: string;
  reason: string | null;
  patient: { full_name: string } | null;
  note: { id: string } | null;
  intake: { id: string } | null;
};
type Hours = { weekday: number; start_time: string; end_time: string };

const STATE = {
  completed: { key: "completed", dot: "bg-ink" },
  note: { key: "note", dot: "bg-brand" },
  answers: { key: "answers", dot: "bg-amber-500" },
  waiting: { key: "waitingShort", dot: "bg-line" },
} as const;

function stateOf(v: Visit) {
  if (v.status === "completed") return STATE.completed;
  if (v.note) return STATE.note;
  if (v.intake) return STATE.answers;
  return STATE.waiting;
}

export default async function CalendarPage({ searchParams }: PageProps<"/doctor/calendar">) {
  const sp = await searchParams;
  const profile = await requireRole("doctor");
  const supabase = await createClient();

  const today = kyivToday(nowDate());
  const requested = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today;
  const monday = weekStart(requested);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  // RLS limits both queries to the signed-in doctor.
  const [{ data: visitRows }, { data: hourRows }, { data: offRows }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, scheduled_at, status, reason, patient:profiles!appointments_patient_id_fkey(full_name), note:notes(id), intake:intakes(id)",
      )
      .eq("doctor_id", profile.id)
      .gte("scheduled_at", kyivDayStartISO(monday))
      .lt("scheduled_at", kyivDayStartISO(addDays(monday, 7)))
      .order("scheduled_at"),
    supabase.from("doctor_hours").select("weekday, start_time, end_time").eq("doctor_id", profile.id),
    // Days off set by the clinic admin that overlap this week.
    supabase
      .from("doctor_time_off")
      .select("start_date, end_date, note")
      .eq("doctor_id", profile.id)
      .lte("start_date", addDays(monday, 6))
      .gte("end_date", monday),
  ]);
  const timeOff = (offRows ?? []) as { start_date: string; end_date: string; note: string }[];
  const offOn = (d: string) => timeOff.find((t) => t.start_date <= d && d <= t.end_date);
  const visits = (visitRows ?? []) as unknown as Visit[];
  const hours = (hourRows ?? []) as Hours[];
  const byDay = new Map(days.map((d) => [d, visits.filter((v) => kyivDayOf(v.scheduled_at) === d)]));
  const completed = visits.filter((v) => v.status === "completed").length;
  const { locale, t } = await getT();
  const d = t.doctor;

  return (
    <PageShell profile={profile} title={d.calendarHeading} subtitle={profile.full_name}>
      <DoctorTabs active="/doctor/calendar" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-ink">{formatWeekRange(monday, locale)}</p>
          <p className="text-sm text-muted">
            {t.common.visits(visits.length)} · {d.completedCount(completed)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/doctor/calendar?week=${addDays(monday, -7)}`}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand"
            aria-label={d.prevWeek}
          >
            ←
          </Link>
          <Link
            href="/doctor/calendar"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand"
          >
            {d.thisWeek}
          </Link>
          <Link
            href={`/doctor/calendar?week=${addDays(monday, 7)}`}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand"
            aria-label={d.nextWeek}
          >
            →
          </Link>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day, i) => {
          const h = hours.find((x) => x.weekday === i + 1);
          const list = byDay.get(day) ?? [];
          const isToday = day === today;
          const off = offOn(day);
          return (
            <section
              key={day}
              aria-label={formatDay(day, locale)}
              className={`flex min-w-0 flex-col lg:min-h-40 rounded-2xl border bg-white p-3 ${
                isToday ? "border-brand ring-2 ring-brand/15" : "border-line"
              } ${off ? "bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgb(254_243_199/0.6)_8px_16px)]" : ""} ${
                !h && list.length === 0 ? "bg-white/60" : ""
              }`}
            >
              <header className="mb-3 flex items-baseline justify-between gap-2 lg:block">
                <p className={`font-semibold ${isToday ? "text-brand-dark" : "text-ink"}`}>
                  {formatDay(day, locale)}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-[11px] font-semibold text-white lg:ml-0 lg:block lg:w-fit">
                      {d.today}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {off ? (
                    <span className="font-semibold text-amber-800">{d.timeOff}{off.note ? ` · ${off.note}` : ""}</span>
                  ) : h ? (
                    `${h.start_time.slice(0, 5)}–${h.end_time.slice(0, 5)}`
                  ) : (
                    d.dayOff
                  )}
                </p>
              </header>
              {list.length === 0 ? (
                <p className="text-sm text-muted/70">{h && !off ? d.noVisits : ""}</p>
              ) : (
                <ul className="grid gap-2">
                  {list.map((v) => {
                    const st = stateOf(v);
                    return (
                      <li key={v.id} className="min-w-0">
                        <Link
                          href={`/doctor/appointment/${v.id}`}
                          className="block rounded-xl border border-line bg-soft/60 px-3 py-2 transition hover:border-brand hover:bg-white"
                        >
                          <p className="text-sm font-semibold text-ink">{formatTime(v.scheduled_at, locale)}</p>
                          <p className="truncate text-sm text-ink" title={v.patient?.full_name}>
                            {v.patient?.full_name ?? t.common.patient}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                            <span className={`size-2 shrink-0 rounded-full ${st.dot}`} aria-hidden />
                            {d.status[st.key]}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
