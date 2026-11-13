import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { QUESTION_SELECT, type MedicalCard, type Question } from "@/lib/medical-card";
import { getT } from "@/lib/i18n/server";
import { QuestionnaireForm } from "./questionnaire-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.patient.questionnaireTitle };
}

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

  const [{ data }, { data: questions }, { data: card }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, doctor:profiles!appointments_doctor_id_fkey(full_name), intake:intakes(id)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("questions").select(QUESTION_SELECT).order("position"),
    supabase.from("medical_cards").select("allergies, medications, conditions").eq("patient_id", profile.id).maybeSingle(),
  ]);

  const appt = data as unknown as Appt | null;
  if (!appt) notFound();
  if (appt.intake || appt.status === "completed") redirect("/patient");
  const { locale, t } = await getT();

  return (
    <PageShell
      profile={profile}
      title={t.patient.beforeVisit}
      subtitle={`${formatDateTime(appt.scheduled_at, locale)} · ${appt.doctor?.full_name ?? t.patient.yourDoctor}`}
    >
      <div className="max-w-2xl">
        <Link href="/patient" className="mb-6 inline-block text-sm text-muted hover:text-brand">
          {t.patient.back}
        </Link>
        <QuestionnaireForm
          appointmentId={appt.id}
          questions={(questions ?? []) as Question[]}
          card={(card as MedicalCard | null) ?? null}
        />
      </div>
    </PageShell>
  );
}
