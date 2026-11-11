import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, nowDate } from "@/lib/format";
import { loadFreeDays } from "@/lib/slots";
import { Card, PageShell } from "@/components/page-shell";
import { SlotPicker } from "@/components/slot-picker";
import { RescheduleForm } from "./reschedule-form";

export const metadata: Metadata = { title: "Reschedule visit — PreVisit" };

type Visit = {
  id: string;
  scheduled_at: string;
  status: string;
  reason: string | null;
  doctor: { id: string; full_name: string; specialty: string | null } | null;
};

export default async function ReschedulePage({ params, searchParams }: PageProps<"/patient/reschedule/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const profile = await requireRole("patient");
  const supabase = await createClient();

  // RLS: a patient can only load their own visit.
  const { data } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, reason, doctor:profiles!appointments_doctor_id_fkey(id, full_name, specialty)")
    .eq("id", id)
    .maybeSingle();
  const visit = data as unknown as Visit | null;
  if (!visit?.doctor) notFound();

  const movable = visit.status === "scheduled" && new Date(visit.scheduled_at) > nowDate();
  const doctor = visit.doctor;

  const { data: hourRows } = await supabase.from("doctor_hours").select("weekday").eq("doctor_id", doctor.id);
  const { days, slotsByDay, firstOpen } = movable
    ? await loadFreeDays(supabase, doctor.id, new Set((hourRows ?? []).map((h) => h.weekday as number)))
    : { days: [] as string[], slotsByDay: new Map<string, string[]>(), firstOpen: undefined };

  const day = days.includes(pick("day") ?? "") ? pick("day")! : firstOpen;
  const slot = (day && slotsByDay.get(day)?.includes(pick("slot") ?? "") && pick("slot")) || undefined;
  const href = (d: string, s?: string) =>
    `/patient/reschedule/${visit.id}?${new URLSearchParams(s ? { day: d, slot: s } : { day: d })}`;

  return (
    <PageShell
      profile={profile}
      title="Reschedule visit"
      subtitle={`${doctor.full_name} · now ${formatDateTime(visit.scheduled_at)}${visit.reason ? ` · ${visit.reason}` : ""}`}
    >
      <Link href="/patient" className="mb-6 inline-block text-sm text-muted hover:text-brand">
        ← Back to my visits
      </Link>

      {!movable ? (
        <Card>
          <p className="font-semibold text-ink">This visit can no longer be moved.</p>
          <p className="mt-1 text-muted">Only upcoming visits that are not completed can be rescheduled.</p>
        </Card>
      ) : (
        <div className="grid gap-8">
          <SlotPicker
            days={days}
            slotsByDay={slotsByDay}
            day={day}
            slot={slot}
            hrefFor={href}
            doctorName={doctor.full_name}
            dayStep="1 · New day"
            timeStep="2 · New time"
          />
          {slot && (
            <section className="max-w-xl">
              <Card>
                <h2 className="text-lg font-bold text-ink">Move your visit</h2>
                <p className="mt-1 text-muted">
                  <span className="line-through">{formatDateTime(visit.scheduled_at)}</span>
                  <span className="mx-2">→</span>
                  <span className="font-semibold text-ink">{formatDateTime(slot)}</span>
                </p>
                <p className="mt-1 mb-5 text-sm text-muted">
                  Your answers and the doctor&apos;s notes stay with the visit.
                </p>
                <RescheduleForm appointmentId={visit.id} slot={slot} />
              </Card>
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
