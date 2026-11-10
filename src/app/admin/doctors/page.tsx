import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageShell } from "@/components/page-shell";
import { AdminTabs } from "../admin-tabs";
import { AddDoctorForm, DoctorCard, type Doctor, type Hours } from "./doctor-editor";

export const metadata: Metadata = { title: "Doctors — PreVisit" };

export default async function DoctorsPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  // RLS limits everything here to the admin's own clinic.
  const [{ data: clinic }, { data: doctors }, { data: hours }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase.from("profiles").select("id, full_name, specialty, active").eq("role", "doctor").order("full_name"),
    supabase.from("doctor_hours").select("doctor_id, weekday, start_time, end_time, slot_minutes").order("weekday"),
  ]);

  const list: Doctor[] = (doctors ?? []).map((d) => ({
    ...d,
    hours: ((hours ?? []) as (Hours & { doctor_id: string })[]).filter((h) => h.doctor_id === d.id),
  }));
  // Active doctors first.
  list.sort((a, b) => Number(b.active) - Number(a.active));

  return (
    <PageShell profile={profile} title="Doctors" subtitle={clinic?.name ?? "Your clinic"}>
      <AdminTabs active="/admin/doctors" />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="grid content-start gap-3">
          {list.length === 0 ? <Empty>No doctors yet. Add the first one.</Empty> : list.map((d) => <DoctorCard key={d.id} doctor={d} />)}
        </section>
        <aside className="h-fit rounded-2xl border border-line bg-white p-6">
          <AddDoctorForm />
        </aside>
      </div>
    </PageShell>
  );
}
