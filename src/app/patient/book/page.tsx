import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { SlotPicker } from "@/components/slot-picker";
import { loadFreeDays } from "@/lib/slots";
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
  const { days, slotsByDay, firstOpen } = doctor
    ? await loadFreeDays(supabase, doctor.id, new Set(doctorHours.map((h) => h.weekday)))
    : { days: [] as string[], slotsByDay: new Map<string, string[]>(), firstOpen: undefined };
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

        {/* 2–3. Day and time */}
        {doctor && (
          <SlotPicker
            days={days}
            slotsByDay={slotsByDay}
            day={day}
            slot={slot}
            hrefFor={(d, sl) => href({ doctor: doctor.id, day: d, slot: sl })}
            doctorName={doctor.full_name}
            dayStep="2 · Day"
            timeStep="3 · Time"
          />
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
