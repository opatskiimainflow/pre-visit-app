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

export const metadata: Metadata = { title: "Analytics — PreVisit" };

type Visit = { id: string; scheduled_at: string; status: string; doctor_id: string; intake: { id: string } | null };
type Doctor = { id: string; full_name: string; specialty: string | null };
type Hours = { doctor_id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number };

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
  const [{ data: clinic }, { data: visitRows }, { data: doctorRows }, { data: hourRows }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, doctor_id, intake:intakes(id)")
      .gte("scheduled_at", kyivDayStartISO(firstMonday))
      .lt("scheduled_at", kyivDayStartISO(loadTo))
      .limit(5000),
    supabase.from("profiles").select("id, full_name, specialty").eq("role", "doctor").eq("active", true).order("full_name"),
    supabase.from("doctor_hours").select("doctor_id, weekday, start_time, end_time, slot_minutes"),
  ]);
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
    </PageShell>
  );
}
