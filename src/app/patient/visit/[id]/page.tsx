import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { QuestionnaireForm } from "./questionnaire-form";

export const metadata: Metadata = { title: "Questionnaire — PreVisit" };

type Appt = {
  id: string;
  scheduled_at: string;
  doctor: { full_name: string } | null;
  status: string;
  intake: { id: string } | null;
};

export default async function VisitPage({ params }: PageProps<"/patient/visit/[id]">) {
  const { id } = await params;
  const profile = await requireRole("patient");
  const supabase = await createClient();

  const [{ data }, { data: questions }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, doctor:profiles!appointments_doctor_id_fkey(full_name), intake:intakes(id)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("questions").select("id, text, kind, required").order("position"),
  ]);

  const appt = data as unknown as Appt | null;
  if (!appt) notFound();
  if (appt.intake || appt.status === "completed") redirect("/patient");

  return (
    <PageShell
      profile={profile}
      title="Before your visit"
      subtitle={`${formatDateTime(appt.scheduled_at)} · ${appt.doctor?.full_name ?? "Your doctor"}`}
    >
      <div className="max-w-2xl">
        <Link href="/patient" className="mb-6 inline-block text-sm text-muted hover:text-brand">
          ← Back to my visits
        </Link>
        <QuestionnaireForm appointmentId={appt.id} questions={questions ?? []} />
      </div>
    </PageShell>
  );
}
