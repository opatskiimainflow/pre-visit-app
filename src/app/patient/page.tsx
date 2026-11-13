import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBirthDate, formatDateTime, kyivToday, nowDate, patientSummary, recentCutoff } from "@/lib/format";
import { Card, Empty, PageShell } from "@/components/page-shell";
import { ConfirmSubmit } from "@/components/buttons";
import { buttonClass } from "@/components/button-styles";
import { cancelMyVisit } from "./book/actions";
import { DetailsCard } from "./details-card";
import { MedicalCardPanel } from "./medical-card";
import { RateForm } from "./rate-form";
import { Stars } from "@/components/stars";
import type { MedicalCard } from "@/lib/medical-card";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.patient.homeTitle };
}

type Row = {
  id: string;
  scheduled_at: string;
  reason: string | null;
  doctor: { full_name: string; specialty: string | null } | null;
  status: string;
  intake: { submitted_at: string } | null;
};

type Past = {
  id: string;
  scheduled_at: string;
  reason: string | null;
  doctor: { full_name: string; specialty: string | null } | null;
  summary: { body: string; updated_at: string } | null;
  rating: { stars: number; comment: string } | null;
};

export default async function PatientPage({ searchParams }: PageProps<"/patient">) {
  const sp = await searchParams;
  const sent = sp.sent === "1";
  const booked = sp.booked === "1";
  const welcome = sp.welcome === "1";
  const moved = sp.moved === "1";
  const profile = await requireRole("patient");
  const supabase = await createClient();

  // RLS limits this to the signed-in patient's own appointments.
  const [{ data: me }, { data: card }, { data }, { data: pastRows }] = await Promise.all([
    supabase.from("profiles").select("date_of_birth, sex").eq("id", profile.id).single(),
    supabase.from("medical_cards").select("allergies, medications, conditions, updated_at").eq("patient_id", profile.id).maybeSingle(),
    supabase
      .from("appointments")
      .select(
        "id, scheduled_at, reason, status, doctor:profiles!appointments_doctor_id_fkey(full_name, specialty), intake:intakes(submitted_at)",
      )
      .eq("status", "scheduled")
      .gte("scheduled_at", recentCutoff())
      .order("scheduled_at"),
    // Completed visits, newest first, with the doctor's summary and the patient's own rating.
    supabase
      .from("appointments")
      .select(
        "id, scheduled_at, reason, doctor:profiles!appointments_doctor_id_fkey(full_name, specialty), summary:visit_summaries(body, updated_at), rating:visit_ratings(stars, comment)",
      )
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false })
      .limit(10),
  ]);

  const visits = (data ?? []) as unknown as Row[];
  const past = (pastRows ?? []) as unknown as Past[];
  const medical = card as (MedicalCard & { updated_at: string }) | null;
  const nowD = nowDate();
  const now = nowD.getTime();
  const { locale, t } = await getT();
  const p = t.patient;
  const firstName = profile.full_name.split(" ")[0];

  return (
    <PageShell
      profile={profile}
      title={p.hi(firstName)}
      subtitle={p.homeSubtitle}
    >
      <div className="mb-6">
        <Link href="/patient/book" className={buttonClass("brand")}>
          {p.bookVisitButton}
        </Link>
      </div>

      <div className="mb-6">
        <DetailsCard
          dob={me?.date_of_birth ?? null}
          sex={me?.sex ?? null}
          summary={patientSummary(me, nowD, locale)}
          birthDate={me?.date_of_birth ? formatBirthDate(me.date_of_birth, locale) : null}
          today={kyivToday(nowD)}
        />
      </div>

      <div className="mb-6">
        <MedicalCardPanel
          card={medical}
          updated={medical?.updated_at ? formatBirthDate(kyivToday(new Date(medical.updated_at)), locale) : null}
        />
      </div>

      {welcome && (
        <div className="mb-6 rounded-2xl border border-brand/30 bg-white p-5 text-ink">
          <p className="font-semibold">{p.welcome(firstName)}</p>
          <p className="text-sm text-muted">{p.welcomeText}</p>
        </div>
      )}

      {moved && (
        <div className="mb-6 rounded-2xl border border-brand/30 bg-white p-5 text-ink">
          <p className="font-semibold">{p.movedTitle}</p>
          <p className="text-sm text-muted">{p.movedText}</p>
        </div>
      )}

      {(sent || booked) && (
        <div className="mb-6 rounded-2xl border border-brand/30 bg-white p-5 text-ink">
          {booked ? (
            <>
              <p className="font-semibold">{p.bookedTitle}</p>
              <p className="text-sm text-muted">{p.bookedText}</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{p.sentTitle}</p>
              <p className="text-sm text-muted">{p.sentText}</p>
            </>
          )}
        </div>
      )}

      <h2 className="mb-4 text-xl font-bold text-ink">{p.upcoming}</h2>
      {visits.length === 0 ? (
        <Empty>{p.noUpcoming}</Empty>
      ) : (
        <div className="grid gap-4">
          {visits.map((v) => {
            const canCancel = v.status === "scheduled" && new Date(v.scheduled_at).getTime() > now;
            return (
              <Card key={v.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink">{formatDateTime(v.scheduled_at, locale)}</p>
                    <p className="text-sm text-muted">
                      {v.doctor?.full_name ?? t.common.doctor}
                      {v.doctor?.specialty ? ` · ${v.doctor.specialty}` : ""}
                      {v.reason ? ` · ${v.reason}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {v.status === "completed" ? (
                      <span className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">{p.visitCompleted}</span>
                    ) : v.intake ? (
                      <span className="rounded-full bg-soft px-4 py-2 text-sm font-medium text-brand-dark">
                        {p.questionnaireSent}
                      </span>
                    ) : (
                      <Link
                        href={`/patient/visit/${v.id}`}
                        className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand"
                      >
                        {p.fillQuestionnaire}
                      </Link>
                    )}
                    {canCancel && (
                      <Link href={`/patient/reschedule/${v.id}`} className={buttonClass("ghost", "sm")}>
                        {p.reschedule}
                      </Link>
                    )}
                    {canCancel && (
                      <form action={cancelMyVisit.bind(null, v.id)}>
                        <ConfirmSubmit confirmText={p.cancelVisit}>{p.cancel}</ConfirmSubmit>
                      </form>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-ink">{p.past}</h2>
          <div className="grid gap-4">
            {past.map((v) => (
              <Card key={v.id}>
                <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{formatDateTime(v.scheduled_at, locale)}</p>
                    <p className="text-sm text-muted">
                      {v.doctor?.full_name ?? t.common.doctor}
                      {v.reason ? ` · ${v.reason}` : ""}
                    </p>
                    {v.summary ? (
                      <div className="mt-3 rounded-xl bg-soft p-4">
                        <p className="text-xs font-semibold tracking-wide text-brand-dark uppercase">
                          {p.recommendations}
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-line text-ink">{v.summary.body}</p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted">{p.noSummary}</p>
                    )}
                  </div>
                  <div className="md:border-l md:border-line md:pl-5">
                    {v.rating ? (
                      <div>
                        <p className="text-sm text-muted">{p.yourRating}</p>
                        <Stars value={v.rating.stars} />
                        {v.rating.comment && <p className="mt-1 text-sm text-ink">“{v.rating.comment}”</p>}
                      </div>
                    ) : (
                      <RateForm appointmentId={v.id} />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
