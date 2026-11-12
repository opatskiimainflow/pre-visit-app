import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatShortDate,
  isoWeekday,
  kyivDayOf,
  kyivDayStartISO,
  kyivToday,
  nowDate,
  weekStart,
} from "@/lib/format";
import { Card, PageShell } from "@/components/page-shell";
import { ColumnChart, MeterList, StatTile, type Column } from "@/components/charts";
import { AdminTabs } from "../admin-tabs";
import { Stars } from "@/components/stars";

export const metadata: Metadata = { title: "Analytics — PreVisit" };

type Visit = { id: string; scheduled_at: string; status: string; doctor_id: string; intake: { id: string } | null };
type Doctor = { id: string; full_name: string; specialty: string | null };
type Hours = { doctor_id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number };
type Rating = {
  stars: number;
  comment: string;
  created_at: string;
  appointment: { doctor_id: string; patient: { full_name: string } | null } | null;
};

const WEEKS = 9; // 8 full weeks + the current one
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default async function AnalyticsPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  const now = nowDate();
  const today = kyivToday(now);
  const thisMonday = weekStart(today);
  const firstMonday = addDays(thisMonday, -7 * (WEEKS - 1));
  const loadFrom = addDays(today, 1);
  const loadTo = addDays(today, 8); // exclusive: the next 7 days

  // RLS limits everything to the admin's own clinic.
  const [{ data: clinic }, { data: visitRows }, { data: doctorRows }, { data: hourRows }, { data: ratingRows }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, doctor_id, intake:intakes(id)")
      .gte("scheduled_at", kyivDayStartISO(firstMonday))
      .lt("scheduled_at", kyivDayStartISO(loadTo))
      .limit(5000),
    supabase.from("profiles").select("id, full_name, specialty").eq("role", "doctor").eq("active", true).order("full_name"),
    supabase.from("doctor_hours").select("doctor_id, weekday, start_time, end_time, slot_minutes"),
    supabase
      .from("visit_ratings")
      .select("stars, comment, created_at, appointment:appointments(doctor_id, patient:profiles!appointments_patient_id_fkey(full_name))")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  const ratings = ((ratingRows ?? []) as unknown as Rating[]).filter((r) => new Date(r.created_at) <= now);
  const visits = (visitRows ?? []) as unknown as Visit[];
  const doctors = (doctorRows ?? []) as Doctor[];
  const hours = (hourRows ?? []) as Hours[];

  // ── Visits and questionnaire completion per week ──
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(firstMonday, i * 7));
  const happened = visits.filter((v) => new Date(v.scheduled_at) <= now);
  const perWeek = weeks.map((monday) => {
    const inWeek = visits.filter((v) => weekStart(kyivDayOf(v.scheduled_at)) === monday);
    const past = inWeek.filter((v) => new Date(v.scheduled_at) <= now);
    return { monday, total: inWeek.length, past: past.length, withAnswers: past.filter((v) => v.intake).length };
  });
  const label = (m: string) => (m === thisMonday ? "This wk" : formatShortDate(m));
  const visitColumns: Column[] = perWeek.map((w) => ({
    key: w.monday,
    label: label(w.monday),
    value: w.total,
    note: w.monday === thisMonday ? "incl. booked" : undefined,
  }));
  const completionColumns: Column[] = perWeek.map((w) => ({
    key: w.monday,
    label: label(w.monday),
    value: pct(w.withAnswers, w.past),
    note: `${w.withAnswers} of ${w.past}`,
  }));

  // ── Headline numbers ──
  const fullWeeks = perWeek.slice(0, -1);
  const lastWeek = fullWeeks.at(-1)?.total ?? 0;
  const thisWeek = perWeek.at(-1)?.total ?? 0;
  const avg = fullWeeks.length ? Math.round(fullWeeks.reduce((s, w) => s + w.total, 0) / fullWeeks.length) : 0;
  const since30 = addDays(today, -30);
  const last30 = happened.filter((v) => kyivDayOf(v.scheduled_at) >= since30);
  const completion30 = pct(last30.filter((v) => v.intake).length, last30.length);
  const upcoming = visits.filter((v) => {
    const d = kyivDayOf(v.scheduled_at);
    return v.status === "scheduled" && d >= loadFrom && d < loadTo;
  });

  // ── Doctor load over the next 7 days: booked slots vs. slots in their hours ──
  const nextDays = Array.from({ length: 7 }, (_, i) => addDays(loadFrom, i));
  const load = doctors.map((d) => {
    const capacity = nextDays.reduce((sum, day) => {
      const h = hours.find((x) => x.doctor_id === d.id && x.weekday === isoWeekday(day));
      return h ? sum + Math.floor((minutes(h.end_time) - minutes(h.start_time)) / h.slot_minutes) : sum;
    }, 0);
    return {
      key: d.id,
      name: d.full_name,
      sub: d.specialty ?? "General practice",
      value: upcoming.filter((v) => v.doctor_id === d.id).length,
      total: capacity,
    };
  });

  const delta = thisWeek - lastWeek;

  // ── Patient feedback ──
  const mean = (list: Rating[]) => (list.length ? list.reduce((sum, r) => sum + r.stars, 0) / list.length : 0);
  const avgRating = mean(ratings);
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, count: ratings.filter((r) => r.stars === n).length }));
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));
  const byDoctor = doctors
    .map((d) => {
      const own = ratings.filter((r) => r.appointment?.doctor_id === d.id);
      return { id: d.id, name: d.full_name, avg: mean(own), count: own.length };
    })
    .filter((d) => d.count > 0);
  const comments = ratings.filter((r) => r.comment).slice(0, 4);

  return (
    <PageShell profile={profile} title="Analytics" subtitle={clinic?.name ?? "Your clinic"}>
      <AdminTabs active="/admin/analytics" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Visits this week"
          value={String(thisWeek)}
          sub={`${delta >= 0 ? "+" : "−"}${Math.abs(delta)} vs last week (${lastWeek})`}
        />
        <StatTile label="Average per week" value={String(avg)} sub="over the last 8 weeks" />
        <StatTile label="Questionnaires filled in" value={`${completion30}%`} sub="of visits in the last 30 days" />
        <StatTile label="Booked, next 7 days" value={String(upcoming.length)} sub={`${formatShortDate(loadFrom)} – ${formatShortDate(addDays(loadTo, -1))}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <h2 className="font-bold text-ink">Visits per week</h2>
          <p className="mb-6 text-sm text-muted">All visits by week; this week includes booked ones.</p>
          <ColumnChart
            columns={visitColumns}
            caption="Visits per week for the last nine weeks"
            emphasize={[weeks[weeks.length - 1], weeks[weeks.length - 2]]}
          />
        </Card>
        <Card>
          <h2 className="font-bold text-ink">Questionnaire completion</h2>
          <p className="mb-6 text-sm text-muted">Share of visits that had answers before the appointment.</p>
          <ColumnChart
            columns={completionColumns}
            max={100}
            format={(n) => `${n}%`}
            caption="Share of visits with a filled-in questionnaire, per week"
            emphasize={[weeks[weeks.length - 2]]}
          />
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="font-bold text-ink">Doctor load, next 7 days</h2>
          <p className="mb-6 text-sm text-muted">Booked visits out of the free slots in each doctor&apos;s working hours.</p>
          {load.length === 0 ? <p className="text-muted">No active doctors.</p> : <MeterList rows={load} />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <h2 className="font-bold text-ink">Patient rating</h2>
          <p className="mb-5 text-sm text-muted">Stars patients gave after a completed visit.</p>
          {ratings.length === 0 ? (
            <p className="text-muted">No ratings yet.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <div>
                <p className="text-4xl font-bold tracking-tight text-ink">{avgRating.toFixed(1)}</p>
                <Stars value={Math.round(avgRating)} />
                <p className="text-sm text-muted">{ratings.length} ratings</p>
              </div>
              <ul className="grid gap-1.5" aria-label="Ratings by number of stars">
                {distribution.map((d) => (
                  <li key={d.n} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2 text-sm">
                    <span className="text-muted">{d.n} ★</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-soft">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${(d.count / maxCount) * 100}%`, minWidth: d.count ? 4 : 0 }}
                      />
                    </span>
                    <span className="text-right text-ink">{d.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {byDoctor.length > 0 && (
            <ul className="mt-6 grid gap-2 border-t border-line pt-4">
              {byDoctor.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-ink">{d.name}</span>
                  <span className="text-muted">
                    <span className="font-semibold text-ink">{d.avg.toFixed(1)}</span> ★ · {d.count} ratings
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="font-bold text-ink">Latest comments</h2>
          <p className="mb-5 text-sm text-muted">What patients wrote with their rating.</p>
          {comments.length === 0 ? (
            <p className="text-muted">No comments yet.</p>
          ) : (
            <ul className="grid gap-4">
              {comments.map((c, i) => (
                <li key={i} className="border-l-2 border-brand/40 pl-3">
                  <Stars value={c.stars} size="text-sm" />
                  <p className="text-ink">“{c.comment}”</p>
                  <p className="text-xs text-muted">
                    {c.appointment?.patient?.full_name ?? "Patient"} · {formatShortDate(kyivDayOf(c.created_at))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
