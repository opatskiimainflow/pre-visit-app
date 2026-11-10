import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatDay, formatTime, isoWeekday, kyivNextDays, nowDate } from "@/lib/format";
import { Card, Empty, PageShell } from "@/components/page-shell";
import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = { title: "Book a visit — PreVisit" };

type Doctor = { id: string; full_name: string; specialty: string | null };
type Hours = { doctor_id: string; weekday: number; start_time: string; end_time: string };

const WEEKDAY = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function href(params: Record<string, string | undefined>) {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  return `/patient/book?${q}`;
}

export default async function BookPage({ searchParams }: PageProps<"/patient/book">) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const profile = await requireRole("patient");
  const supabase = await createClient();

  // RLS: patients see only their clinic's doctors and their working hours.
  const [{ data: doctorRows }, { data: hourRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, specialty").eq("role", "doctor").eq("active", true).order("full_name"),
    supabase.from("doctor_hours").select("doctor_id, weekday, start_time, end_time").order("weekday"),
  ]);
  const doctors = (doctorRows ?? []) as Doctor[];
  const hours = (hourRows ?? []) as Hours[];

  const doctor = doctors.find((d) => d.id === pick("doctor"));
  const doctorHours = doctor ? hours.filter((h) => h.doctor_id === doctor.id) : [];
  const workDays = new Set(doctorHours.map((h) => h.weekday));
  const days = doctor ? kyivNextDays(nowDate(), 14).filter((d) => workDays.has(isoWeekday(d))) : [];

  // Free slots for every working day (a handful of small parallel calls), so we can
  // open the first day that actually has free times and mark full days.
  const slotsByDay = new Map<string, string[]>();
  if (doctor) {
    const results = await Promise.all(
      days.map((d) => supabase.rpc("free_slots", { p_doctor: doctor.id, p_day: d })),
    );
    days.forEach((d, i) =>
      slotsByDay.set(d, ((results[i].data ?? []) as string[]).map((s) => new Date(s).toISOString())),
    );
  }
  const firstOpen = days.find((d) => (slotsByDay.get(d)?.length ?? 0) > 0) ?? days[0];
  const day = days.includes(pick("day") ?? "") ? pick("day")! : firstOpen;
  const slots = (day && slotsByDay.get(day)) || [];
  const slot = slots.includes(pick("slot") ?? "") ? pick("slot") : undefined;

  return (
    <PageShell profile={profile} title="Book a visit" subtitle="Choose a doctor, a day and a free time.">
      <Link href="/patient" className="mb-6 inline-block text-sm text-muted hover:text-brand">
        ← Back to my visits
      </Link>

      <div className="grid gap-8">
        {/* 1. Doctor */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-brand-dark uppercase">1 · Doctor</h2>
          {doctors.length === 0 ? (
            <Empty>No doctors are available at your clinic yet.</Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {doctors.map((d) => {
                const days = [...new Set(hours.filter((h) => h.doctor_id === d.id).map((h) => h.weekday))];
                const active = d.id === doctor?.id;
                return (
                  <Link
                    key={d.id}
                    href={href({ doctor: d.id })}
                    aria-current={active ? "true" : undefined}
                    className={`rounded-2xl border bg-white p-5 transition hover:border-brand ${
                      active ? "border-brand ring-2 ring-brand/20" : "border-line"
                    }`}
                  >
                    <p className="font-semibold text-ink">{d.full_name}</p>
                    <p className="text-sm text-muted">{d.specialty ?? "General practice"}</p>
                    <p className="mt-2 text-xs text-muted">
                      {days.length ? days.map((w) => WEEKDAY[w]).join(" · ") : "No working hours set"}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. Day */}
        {doctor && (
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-brand-dark uppercase">2 · Day</h2>
            {days.length === 0 ? (
              <Empty>{doctor.full_name} has no working days in the next two weeks.</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {days.map((d) => {
                  const free = slotsByDay.get(d)?.length ?? 0;
                  if (free === 0 && d !== day) {
                    return (
                      <span
                        key={d}
                        className="rounded-full border border-dashed border-line px-4 py-2 text-sm text-muted/70"
                        title="No free times"
                      >
                        {formatDay(d)} · full
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={d}
                      href={href({ doctor: doctor.id, day: d })}
                      aria-current={d === day ? "date" : undefined}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        d === day ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-brand"
                      }`}
                    >
                      {formatDay(d)}
                      <span className={d === day ? "ml-1.5 text-white/70" : "ml-1.5 text-muted"}>{free}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 3. Time */}
        {doctor && day && (
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-brand-dark uppercase">
              3 · Time <span className="font-normal normal-case text-muted">({formatDay(day)}, clinic time)</span>
            </h2>
            {slots.length === 0 ? (
              <Empty>No free times on this day. Try another day.</Empty>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {slots.map((s) => (
                  <Link
                    key={s}
                    href={href({ doctor: doctor.id, day, slot: s })}
                    aria-current={s === slot ? "time" : undefined}
                    className={`rounded-xl border px-3 py-2.5 text-center font-semibold transition ${
                      s === slot ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-brand"
                    }`}
                  >
                    {formatTime(s)}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 4. Confirm */}
        {doctor && slot && (
          <section className="max-w-xl">
            <Card>
              <h2 className="text-lg font-bold text-ink">Confirm your visit</h2>
              <p className="mt-1 mb-5 text-muted">
                {doctor.full_name} · {formatDateTime(slot)}
              </p>
              <ConfirmForm doctorId={doctor.id} slot={slot} />
            </Card>
          </section>
        )}
      </div>
    </PageShell>
  );
}
