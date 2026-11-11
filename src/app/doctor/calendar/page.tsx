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

export const metadata: Metadata = { title: "Week calendar — PreVisit" };

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
  completed: { label: "Completed", dot: "bg-ink" },
  note: { label: "Note ready", dot: "bg-brand" },
  answers: { label: "Answers in", dot: "bg-amber-500" },
  waiting: { label: "Waiting", dot: "bg-line" },
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
  const [{ data: visitRows }, { data: hourRows }] = await Promise.all([
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
  ]);
  const visits = (visitRows ?? []) as unknown as Visit[];
  const hours = (hourRows ?? []) as Hours[];
  const byDay = new Map(days.map((d) => [d, visits.filter((v) => kyivDayOf(v.scheduled_at) === d)]));
  const completed = visits.filter((v) => v.status === "completed").length;

  return (
    <PageShell profile={profile} title="Week calendar" subtitle={profile.full_name}>
      <DoctorTabs active="/doctor/calendar" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-ink">{formatWeekRange(monday)}</p>
          <p className="text-sm text-muted">
            {visits.length} {visits.length === 1 ? "visit" : "visits"} · {completed} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/doctor/calendar?week=${addDays(monday, -7)}`}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand"
            aria-label="Previous week"
          >
            ←
          </Link>
          <Link
            href="/doctor/calendar"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand"
          >
            This week
          </Link>
          <Link
            href={`/doctor/calendar?week=${addDays(monday, 7)}`}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand"
            aria-label="Next week"
          >
            →
          </Link>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((d, i) => {
          const h = hours.find((x) => x.weekday === i + 1);
          const list = byDay.get(d) ?? [];
          const isToday = d === today;
          return (
            <section
              key={d}
              aria-label={formatDay(d)}
              className={`flex min-w-0 flex-col lg:min-h-40 rounded-2xl border bg-white p-3 ${
                isToday ? "border-brand ring-2 ring-brand/15" : "border-line"
              } ${!h && list.length === 0 ? "bg-white/60" : ""}`}
            >
              <header className="mb-3 flex items-baseline justify-between gap-2 lg:block">
                <p className={`font-semibold ${isToday ? "text-brand-dark" : "text-ink"}`}>
                  {formatDay(d)}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-[11px] font-semibold text-white lg:ml-0 lg:block lg:w-fit">
                      Today
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {h ? `${h.start_time.slice(0, 5)}–${h.end_time.slice(0, 5)}` : "Day off"}
                </p>
              </header>
              {list.length === 0 ? (
                <p className="text-sm text-muted/70">{h ? "No visits" : ""}</p>
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
                          <p className="text-sm font-semibold text-ink">{formatTime(v.scheduled_at)}</p>
                          <p className="truncate text-sm text-ink" title={v.patient?.full_name}>
                            {v.patient?.full_name ?? "Patient"}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                            <span className={`size-2 shrink-0 rounded-full ${st.dot}`} aria-hidden />
                            {st.label}
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
