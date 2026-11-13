import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, kyivToday, nowDate, patientSummary, recentCutoff } from "@/lib/format";
import { Empty, PageShell } from "@/components/page-shell";
import { ConfirmSubmit } from "@/components/buttons";
import { StatusChip } from "@/components/status-chip";
import { AdminTabs } from "./admin-tabs";
import { buttonClass } from "@/components/button-styles";
import { BookForm } from "./book-form";
import { cancelAppointment } from "./actions";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.admin.apptsTitle };
}

type Row = {
  id: string;
  scheduled_at: string;
  reason: string | null;
  status: string;
  patient: { full_name: string; date_of_birth: string | null; sex: string | null } | null;
  doctor: { full_name: string } | null;
  note: { id: string } | null;
  intake: { id: string } | null;
};

export default async function AdminPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  // RLS limits everything here to the admin's own clinic.
  const [{ data: clinic }, { data: appts }, { data: people }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase
      .from("appointments")
      .select(
        "id, scheduled_at, reason, status, patient:profiles!appointments_patient_id_fkey(full_name, date_of_birth, sex), doctor:profiles!appointments_doctor_id_fkey(full_name), note:notes(id), intake:intakes(id)",
      )
      .gte("scheduled_at", recentCutoff())
      .order("scheduled_at")
      .limit(50),
    supabase.from("profiles").select("id, full_name, role, active").in("role", ["patient", "doctor"]).order("full_name"),
  ]);

  const rows = (appts ?? []) as unknown as Row[];
  const patients = (people ?? []).filter((p) => p.role === "patient");
  const doctors = (people ?? []).filter((p) => p.role === "doctor" && p.active);
  const now = nowDate();
  const { locale, t } = await getT();
  const a_ = t.admin;

  return (
    <PageShell profile={profile} title={a_.apptsHeading} subtitle={clinic?.name ?? a_.yourClinic}>
      <AdminTabs active="/admin" />
      <div className="-mt-4 mb-4 flex justify-end">
        <a href="/admin/export/visits" download className={buttonClass("ghost", "sm")}>
          {a_.exportVisits}
        </a>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="grid content-start gap-3">
          {rows.length === 0 ? (
            <Empty>{a_.noUpcoming}</Empty>
          ) : (
            rows.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5">
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
                    <p className="text-sm text-muted">
                      {a.doctor?.full_name ?? t.common.doctor}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip visit={a} />
                  {a.status === "scheduled" && (
                    <form action={cancelAppointment.bind(null, a.id)}>
                      <ConfirmSubmit confirmText={a_.cancelVisit}>{t.common.cancel}</ConfirmSubmit>
                    </form>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
        <aside className="h-fit rounded-2xl border border-line bg-white p-6">
          <BookForm patients={patients} doctors={doctors} today={kyivToday(now)} />
        </aside>
      </div>
    </PageShell>
  );
}
