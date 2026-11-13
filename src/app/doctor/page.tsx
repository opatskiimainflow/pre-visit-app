import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, nowDate, patientSummary, recentCutoff } from "@/lib/format";
import Link from "next/link";
import { Empty, PageShell } from "@/components/page-shell";
import { StatusChip } from "@/components/status-chip";
import { DoctorTabs } from "./doctor-tabs";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.doctor.upcomingTitle };
}

type Row = {
  id: string;
  scheduled_at: string;
  status: string;
  reason: string | null;
  patient: { full_name: string; date_of_birth: string | null; sex: string | null } | null;
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
      "id, scheduled_at, status, reason, patient:profiles!appointments_patient_id_fkey(full_name, date_of_birth, sex), note:notes(id), intake:intakes(submitted_at)",
    )
    .gte("scheduled_at", recentCutoff())
    .order("scheduled_at")
    .limit(20);

  const rows = (data ?? []) as unknown as Row[];
  const now = nowDate();
  const { locale, t } = await getT();

  return (
    <PageShell profile={profile} title={t.doctor.upcomingHeading} subtitle={profile.full_name}>
      <DoctorTabs active="/doctor" />
      {rows.length === 0 ? (
        <Empty>{t.doctor.noAppointments}</Empty>
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
                    <span className="block font-semibold text-ink">{formatTime(a.scheduled_at, locale)}</span>
                    <span className="block text-xs text-muted">{formatDayLabel(a.scheduled_at, now, locale)}</span>
                  </span>
                  <div>
                    <p className="font-semibold text-ink">
                      {a.patient?.full_name ?? t.common.patient}
                      {patientSummary(a.patient, now, locale) && (
                        <span className="ml-2 text-sm font-normal text-muted">{patientSummary(a.patient, now, locale)}</span>
                      )}
                    </p>
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
