import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, kyivToday, nowDate, patientSummary, recentCutoff } from "@/lib/format";
import { Empty, PageShell } from "@/components/page-shell";
import { ConfirmSubmit } from "@/components/buttons";
import { StatusChip } from "@/components/status-chip";
import { AdminTabs } from "./admin-tabs";
import { BookForm } from "./book-form";
import { cancelAppointment } from "./actions";

export const metadata: Metadata = { title: "Appointments — PreVisit" };

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

  return (
    <PageShell profile={profile} title="Clinic appointments" subtitle={clinic?.name ?? "Your clinic"}>
      <AdminTabs active="/admin" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="grid content-start gap-3">
          {rows.length === 0 ? (
            <Empty>No upcoming visits. Book one on the right.</Empty>
          ) : (
            rows.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5">
                <div className="flex items-center gap-4">
                  <span className="min-w-20 rounded-xl bg-soft px-3 py-1.5 text-center">
                    <span className="block font-semibold text-ink">{formatTime(a.scheduled_at)}</span>
                    <span className="block text-xs text-muted">{formatDayLabel(a.scheduled_at, now)}</span>
                  </span>
                  <div>
                    <p className="font-semibold text-ink">
                      {a.patient?.full_name ?? "Patient"}
                      {patientSummary(a.patient, now) && (
                        <span className="ml-2 text-sm font-normal text-muted">{patientSummary(a.patient, now)}</span>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {a.doctor?.full_name ?? "Doctor"}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip visit={a} />
                  {a.status === "scheduled" && (
                    <form action={cancelAppointment.bind(null, a.id)}>
                      <ConfirmSubmit confirmText="Cancel visit">Cancel</ConfirmSubmit>
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
