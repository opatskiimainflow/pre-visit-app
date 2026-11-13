import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBirthDate, formatDateTime, nowDate, patientSummary } from "@/lib/format";
import { Empty, PageShell } from "@/components/page-shell";
import { AdminTabs } from "../admin-tabs";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.admin.patientsTitle };
}

type Visit = { patient_id: string; scheduled_at: string; status: string; doctor: { full_name: string } | null };

export default async function PatientsPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  // RLS limits everything here to the admin's own clinic.
  const [{ data: clinic }, { data: patients }, { data: visits }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase.from("profiles").select("id, full_name, date_of_birth, sex").eq("role", "patient").order("full_name"),
    supabase
      .from("appointments")
      .select("patient_id, scheduled_at, status, doctor:profiles!appointments_doctor_id_fkey(full_name)")
      .order("scheduled_at"),
  ]);

  const now = nowDate();
  const all = (visits ?? []) as unknown as Visit[];
  const rows = (patients ?? []).map((p) => {
    const mine = all.filter((v) => v.patient_id === p.id);
    return {
      ...p,
      completed: mine.filter((v) => v.status === "completed").length,
      next: mine.find((v) => v.status === "scheduled" && new Date(v.scheduled_at) > now) ?? null,
    };
  });

  const { locale, t } = await getT();
  const a = t.admin;

  return (
    <PageShell profile={profile} title={a.tabs.patients} subtitle={clinic?.name ?? a.yourClinic}>
      <AdminTabs active="/admin/patients" />
      {rows.length === 0 ? (
        <Empty>{a.noPatients}</Empty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="hidden grid-cols-[1.4fr_1fr_0.6fr_1.4fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold tracking-wide text-muted uppercase md:grid">
            <span>{a.cols.patient}</span>
            <span>{a.cols.born}</span>
            <span>{a.cols.pastVisits}</span>
            <span>{a.cols.nextVisit}</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id} className="grid gap-1 px-5 py-4 md:grid-cols-[1.4fr_1fr_0.6fr_1.4fr] md:items-center md:gap-4">
                <div>
                  <p className="font-semibold text-ink">{p.full_name}</p>
                  <p className="text-sm text-muted">{patientSummary(p, now, locale) ?? a.noAgeSex}</p>
                </div>
                <p className="text-sm text-ink">
                  <span className="text-muted md:hidden">{a.cols.born}: </span>
                  {p.date_of_birth ? formatBirthDate(p.date_of_birth, locale) : "—"}
                </p>
                <p className="text-sm text-ink">
                  <span className="text-muted md:hidden">{a.completedVisits}: </span>
                  {p.completed}
                </p>
                <p className="text-sm text-ink">
                  <span className="text-muted md:hidden">{a.cols.nextVisit}: </span>
                  {p.next ? (
                    <>
                      {formatDateTime(p.next.scheduled_at, locale)}
                      <span className="block text-muted">{p.next.doctor?.full_name}</span>
                    </>
                  ) : (
                    <span className="text-muted">{a.noneBooked}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  );
}
