import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatDayLabel, formatTime, nowDate, patientSummary } from "@/lib/format";
import { Card, PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/buttons";
import { StatusChip } from "@/components/status-chip";
import type { Answer, Note } from "@/lib/ai/note";
import { DEMO_MODEL } from "@/lib/ai/demo-note";
import { GenerateNoteButton } from "./generate-button";
import { NoteCard } from "./note-card";
import { DoctorNotes } from "./doctor-notes";
import { setVisitStatus } from "./actions";

export const metadata: Metadata = { title: "Visit — PreVisit" };

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
      "id, scheduled_at, reason, status, completed_at, patient_id, patient:profiles!appointments_patient_id_fkey(full_name, date_of_birth, sex), intake:intakes(answers, submitted_at), note:notes(content, model, created_at, edited_at), doctor_note:doctor_notes(body)",
    )
    .eq("id", id)
    .maybeSingle();

  const appt = data as unknown as Appt | null;
  if (!appt) notFound();

  // Earlier visits of this patient with this doctor (RLS: a doctor sees only their own visits).
  const { data: historyRows } = await supabase
    .from("appointments")
    .select("id, scheduled_at, reason, status, note:notes(content)")
    .eq("patient_id", appt.patient_id)
    .lt("scheduled_at", appt.scheduled_at)
    .order("scheduled_at", { ascending: false })
    .limit(5);
  const history = (historyRows ?? []) as unknown as History[];
  const completed = appt.status === "completed";

  const badge =
    appt.note?.model === DEMO_MODEL || appt.note?.model === "demo-seed" ? (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
        Demo mode · rule-based, no AI
      </span>
    ) : (
      <span className="text-xs text-muted">AI-prepared{appt.note?.model ? ` · ${appt.note.model}` : ""}</span>
    );

  return (
    <PageShell
      profile={profile}
      title={appt.patient?.full_name ?? "Patient"}
      subtitle={`${patientSummary(appt.patient, nowDate()) ? `${patientSummary(appt.patient, nowDate())} · ` : ""}${formatDayLabel(appt.scheduled_at, nowDate())}, ${formatTime(appt.scheduled_at)}${appt.reason ? ` · ${appt.reason}` : ""}`}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link href="/doctor" className="text-sm text-muted hover:text-brand">
          ← All appointments
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip visit={appt} />
          {completed && appt.completed_at && (
            <span className="text-sm text-muted">{formatDateTime(appt.completed_at)}</span>
          )}
          <form action={setVisitStatus.bind(null, appt.id, completed ? "scheduled" : "completed")}>
            <SubmitButton size="sm" variant={completed ? "ghost" : "primary"} pendingText="Saving…">
              {completed ? "Reopen visit" : "Mark visit as completed"}
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
              <h2 className="text-xl font-bold text-ink">No note yet</h2>
              <p className="mt-1 mb-5 text-muted">The patient&apos;s answers are in. Prepare a note from them.</p>
              <GenerateNoteButton appointmentId={appt.id} />
            </Card>
          ) : (
            <Card>
              <h2 className="text-xl font-bold text-ink">Waiting for the patient</h2>
              <p className="mt-1 text-muted">The questionnaire hasn&apos;t been filled in yet.</p>
            </Card>
          )}
          <DoctorNotes appointmentId={appt.id} body={appt.doctor_note?.body ?? ""} />
        </section>

        <aside className="grid content-start gap-6">
          <Card>
            <h2 className="font-bold text-ink">Previous visits</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">First visit with you.</p>
            ) : (
              <ol className="mt-4 grid gap-3">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link href={`/doctor/appointment/${h.id}`} className="block rounded-xl bg-soft p-3 hover:ring-1 hover:ring-brand">
                      <p className="text-sm font-semibold text-ink">
                        {formatDateTime(h.scheduled_at)}
                        {h.status === "completed" && <span className="ml-2 text-xs font-normal text-muted">completed</span>}
                      </p>
                      <p className="text-sm text-muted">
                        {h.note?.content.chief_complaint ?? h.reason ?? "No note"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card>
            <h2 className="font-bold text-ink">Patient&apos;s answers</h2>
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
              <p className="mt-2 text-sm text-muted">No answers yet.</p>
            )}
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}
