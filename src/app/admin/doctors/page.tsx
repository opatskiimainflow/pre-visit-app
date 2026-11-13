import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageShell } from "@/components/page-shell";
import { AdminTabs } from "../admin-tabs";
import { AddDoctorForm, DoctorCard, type Doctor, type Hours, type TimeOff } from "./doctor-editor";
import { kyivToday, nowDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.admin.doctorsTitle };
}

export default async function DoctorsPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  // RLS limits everything here to the admin's own clinic.
  const today = kyivToday(nowDate());
  const [{ data: clinic }, { data: doctors }, { data: hours }, { data: timeOff }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase.from("profiles").select("id, full_name, specialty, active").eq("role", "doctor").order("full_name"),
    supabase.from("doctor_hours").select("doctor_id, weekday, start_time, end_time, slot_minutes").order("weekday"),
    supabase
      .from("doctor_time_off")
      .select("id, doctor_id, start_date, end_date, note")
      .gte("end_date", today)
      .order("start_date"),
  ]);

  const list: Doctor[] = (doctors ?? []).map((d) => ({
    ...d,
    hours: ((hours ?? []) as (Hours & { doctor_id: string })[]).filter((h) => h.doctor_id === d.id),
    timeOff: ((timeOff ?? []) as (TimeOff & { doctor_id: string })[]).filter((t) => t.doctor_id === d.id),
  }));
  // Active doctors first.
  list.sort((a, b) => Number(b.active) - Number(a.active));

  const { t } = await getT();

  return (
    <PageShell profile={profile} title={t.admin.tabs.doctors} subtitle={clinic?.name ?? t.admin.yourClinic}>
      <AdminTabs active="/admin/doctors" />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="grid content-start gap-3">
          {list.length === 0 ? <Empty>{t.admin.noDoctorsYet}</Empty> : list.map((d) => <DoctorCard key={d.id} doctor={d} today={today} />)}
        </section>
        <aside className="h-fit rounded-2xl border border-line bg-white p-6">
          <AddDoctorForm />
        </aside>
      </div>
    </PageShell>
  );
}
