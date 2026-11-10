import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, nowDate, recentCutoff } from "@/lib/format";
import Link from "next/link";
import { Empty, PageShell } from "@/components/page-shell";
import { StatusChip } from "@/components/status-chip";

export const metadata: Metadata = { title: "Today — PreVisit" };

type Row = {
  id: string;
  scheduled_at: string;
  status: string;
  reason: string | null;
  patient: { full_name: string } | null;
  note: { id: string } | null;
  intake: { submitted_at: string } | null;
};

export default async function DoctorPage() {
  const profile = await requireRole("doctor");
  const supabase = await createClient();

  // RLS limits this to the signed-in doctor's own appointments.
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, reason, patient:profiles!appointments_patient_id_fkey(full_name), note:notes(id), intake:intakes(submitted_at)",
    )
    .gte("scheduled_at", recentCutoff())
    .order("scheduled_at")
    .limit(20);

  const rows = (data ?? []) as unknown as Row[];
  const now = nowDate();

  return (
    <PageShell profile={profile} title="Upcoming appointments" subtitle={profile.full_name}>
      {rows.length === 0 ? (
        <Empty>No appointments yet.</Empty>
      ) : (
        <div className="grid gap-3">
          {rows.map((a) => (
            <Link
              key={a.id}
              href={`/doctor/appointment/${a.id}`}
              className="block rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="min-w-20 rounded-xl bg-soft px-3 py-1.5 text-center">
                    <span className="block font-semibold text-ink">{formatTime(a.scheduled_at)}</span>
                    <span className="block text-xs text-muted">{formatDayLabel(a.scheduled_at, now)}</span>
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{a.patient?.full_name ?? "Patient"}</p>
                    {a.reason && <p className="text-sm text-muted">{a.reason}</p>}
                  </div>
                </div>
                <StatusChip visit={a} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
