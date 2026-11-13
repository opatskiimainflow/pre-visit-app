import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatDayLabel, formatTime, nowDate, patientSummary } from "@/lib/format";
import { Card, PageShell } from "@/components/page-shell";
import { ACTIONS, EVENT_SELECT, describeEvent, type VisitEvent } from "@/lib/events";
import { SubmitButton } from "@/components/buttons";
import { StatusChip } from "@/components/status-chip";
import type { Answer, Note } from "@/lib/ai/note";
import { DEMO_MODEL } from "@/lib/ai/demo-note";
import { GenerateNoteButton } from "./generate-button";
import { NoteCard } from "./note-card";
import { DoctorNotes } from "./doctor-notes";
import { setVisitStatus } from "./actions";
import { SummaryForm } from "./summary-form";
import { ComparisonCard } from "./comparison-card";
import { compareNotes } from "@/lib/compare";
import { CARD_FIELDS, type MedicalCard } from "@/lib/medical-card";
import { buttonClass } from "@/components/button-styles";
import { Stars } from "@/components/stars";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.doctor.visitTitle };
}

type Appt = {
  id: string;
  scheduled_at: string;
  reason: string | null;
  status: string;
  completed_at: string | null;
  patient_id: string;
  patient: { full_name: string; date_of_birth: string | null; sex: string | null } | null;
  intake: { answers: Answer[]; submitted_at: string } | null;
  note: { content: Note; model: string | null; created_at: string; edited_at: string | null } | null;
  doctor_note: { body: string } | null;
  summary: { body: string } | null;
  rating: { stars: number; comment: string } | null;
};

type History = {
  id: string;
  scheduled_at: string;
  reason: string | null;
  status: string;
  note: { content: Note } | null;
};

export default async function AppointmentPage({ params }: PageProps<"/doctor/appointment/[id]">) {
  const { id } = await params;
  const profile = await requireRole("doctor");
  const supabase = await createClient();

  // RLS: only the doctor of this visit gets a row back.
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, reason, status, completed_at, patient_id, patient:profiles!appointments_patient_id_fkey(full_name, date_of_birth, sex), intake:intakes(answers, submitted_at), note:notes(content, model, created_at, edited_at), doctor_note:doctor_notes(body), summary:visit_summaries(body), rating:visit_ratings(stars, comment)",
    )
    .eq("id", id)
    .maybeSingle();

  const appt = data as unknown as Appt | null;
  if (!appt) notFound();

  // Earlier visits of this patient with this doctor (RLS: a doctor sees only their own visits).
  const [{ data: historyRows }, { data: eventRows }, { data: cardRow }, { data: prevRows }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, scheduled_at, reason, status, note:notes(content)")
      .eq("patient_id", appt.patient_id)
      .lt("scheduled_at", appt.scheduled_at)
      .order("scheduled_at", { ascending: false })
      .limit(5),
    // Change history of this visit (audit log, written by database triggers).
    supabase
      .from("appointment_events")
      .select(EVENT_SELECT)
      .eq("appointment_id", appt.id)
      .order("created_at")
      .order("id"),
    supabase.from("medical_cards").select("allergies, medications, conditions").eq("patient_id", appt.patient_id).maybeSingle(),
    // The most recent earlier visit that has a note, for "Since the last visit" (may be older than the list above).
    supabase
      .from("appointments")
      .select("id, scheduled_at, reason, status, note:notes!inner(content)")
      .eq("patient_id", appt.patient_id)
      .lt("scheduled_at", appt.scheduled_at)
      .order("scheduled_at", { ascending: false })
      .limit(1),
  ]);
  const card = cardRow as MedicalCard | null;
  const events = ((eventRows ?? []) as VisitEvent[]).filter((e) => new Date(e.created_at) <= nowDate());
  const history = (historyRows ?? []) as unknown as History[];
  const completed = appt.status === "completed";
  const { locale, t } = await getT();
  const d = t.doctor;
  const now = nowDate();
  const summary = patientSummary(appt.patient, now, locale);
  // Compare with the most recent earlier visit that has a note.
  const previous = ((prevRows ?? []) as unknown as History[])[0];
  const comparison = previous?.note && appt.note ? compareNotes(previous.note.content, appt.note.content) : null;

  const badge =
    appt.note?.model === DEMO_MODEL || appt.note?.model === "demo-seed" ? (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
        {d.demoBadge}
      </span>
    ) : (
      <span className="text-xs text-muted">{d.aiPrepared}{appt.note?.model ? ` · ${appt.note.model}` : ""}</span>
    );

  return (
    <PageShell
      profile={profile}
      title={appt.patient?.full_name ?? t.common.patient}
      subtitle={`${summary ? `${summary} · ` : ""}${formatDayLabel(appt.scheduled_at, now, locale)}, ${formatTime(appt.scheduled_at, locale)}${appt.reason ? ` · ${appt.reason}` : ""}`}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link href="/doctor" className="text-sm text-muted hover:text-brand">
          {d.allAppointments}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/doctor/appointment/${appt.id}/print`} target="_blank" className={buttonClass("ghost", "sm")}>
            {d.print}
          </Link>
          <StatusChip visit={appt} />
          {completed && appt.completed_at && (
            <span className="text-sm text-muted">{formatDateTime(appt.completed_at, locale)}</span>
          )}
          <form action={setVisitStatus.bind(null, appt.id, completed ? "scheduled" : "completed")}>
            <SubmitButton size="sm" variant={completed ? "ghost" : "primary"} pendingText={t.common.saving}>
              {completed ? d.reopen : d.markCompleted}
            </SubmitButton>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="grid content-start gap-6">
          {appt.note ? (
            <NoteCard
              appointmentId={appt.id}
              note={appt.note.content}
              badge={badge}
              editedAt={appt.note.edited_at}
              canEdit={!completed}
            />
          ) : appt.intake ? (
            <Card>
              <h2 className="text-xl font-bold text-ink">{d.noNoteYet}</h2>
              <p className="mt-1 mb-5 text-muted">{d.answersIn}</p>
              <GenerateNoteButton appointmentId={appt.id} />
            </Card>
          ) : (
            <Card>
              <h2 className="text-xl font-bold text-ink">{d.waitingTitle}</h2>
              <p className="mt-1 text-muted">{d.waitingText}</p>
            </Card>
          )}
          {comparison && previous && <ComparisonCard previous={previous} comparison={comparison} />}
          <SummaryForm appointmentId={appt.id} body={appt.summary?.body ?? ""} completed={completed} />
          <DoctorNotes appointmentId={appt.id} body={appt.doctor_note?.body ?? ""} />
        </section>

        <aside className="grid content-start gap-6">
          {appt.rating && (
            <Card>
              <h2 className="font-bold text-ink">{d.patientRating}</h2>
              <Stars value={appt.rating.stars} label={t.common.starsOutOf(appt.rating.stars)} />
              {appt.rating.comment && <p className="mt-1 text-sm text-ink">“{appt.rating.comment}”</p>}
            </Card>
          )}
          <Card>
            <h2 className="font-bold text-ink">{d.medicalCard}</h2>
            {card && CARD_FIELDS.some((f) => card[f.key]) ? (
              <dl className="mt-3 grid gap-3">
                {CARD_FIELDS.map((f) => (
                  <div key={f.key}>
                    <dt className="text-sm text-muted">{t.patient.cardFields[f.key].label}</dt>
                    <dd className="text-ink">{card[f.key] || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted">{d.noCard}</p>
            )}
          </Card>
          <Card>
            <h2 className="font-bold text-ink">{d.previousVisits}</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{d.firstVisit}</p>
            ) : (
              <ol className="mt-4 grid gap-3">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link href={`/doctor/appointment/${h.id}`} className="block rounded-xl bg-soft p-3 hover:ring-1 hover:ring-brand">
                      <p className="text-sm font-semibold text-ink">
                        {formatDateTime(h.scheduled_at, locale)}
                        {h.status === "completed" && (
                          <span className="ml-2 text-xs font-normal text-muted">{d.completedLower}</span>
                        )}
                      </p>
                      <p className="text-sm text-muted">
                        {h.note?.content.chief_complaint ?? h.reason ?? d.noNote}
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card>
            <h2 className="font-bold text-ink">{d.answers}</h2>
            {appt.intake ? (
              <ol className="mt-4 grid gap-4">
                {appt.intake.answers.map((a, i) => (
                  <li key={i}>
                    <p className="text-sm text-muted">{a.question}</p>
                    <p className="text-ink">{a.answer || "—"}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">{d.noAnswers}</p>
            )}
          </Card>
          <Card>
            <h2 className="font-bold text-ink">{d.visitHistory}</h2>
            {events.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{d.noChanges}</p>
            ) : (
              <ol className="mt-4 grid gap-3 border-l border-line pl-4">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span
                      className={`absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-2 ring-white ${ACTIONS[e.action]?.dot ?? "bg-muted"}`}
                      aria-hidden
                    />
                    <p className="text-sm text-ink">
                      <span className="font-semibold">
                        {e.actor_name === "System" ? t.events.roles.system : e.actor_name}
                      </span>{" "}
                      {describeEvent(e, false, locale)}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(e.created_at, locale)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}
