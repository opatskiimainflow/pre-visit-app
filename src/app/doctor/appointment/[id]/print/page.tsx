import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBirthDate, formatDateTime, nowDate, patientSummary } from "@/lib/format";
import { CARD_FIELDS, type MedicalCard } from "@/lib/medical-card";
import type { Answer, Note } from "@/lib/ai/note";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Pre-visit note — PreVisit" };

type Appt = {
  id: string;
  scheduled_at: string;
  reason: string | null;
  status: string;
  patient_id: string;
  patient: { full_name: string; date_of_birth: string | null; sex: string | null } | null;
  doctor: { full_name: string; specialty: string | null } | null;
  clinic: { name: string } | null;
  intake: { answers: Answer[]; submitted_at: string } | null;
  note: { content: Note; edited_at: string | null } | null;
  doctor_note: { body: string } | null;
  summary: { body: string } | null;
};

/** A plain, printable page for the paper chart. The browser's "Save as PDF" makes the PDF. */
export default async function PrintNotePage({ params }: PageProps<"/doctor/appointment/[id]/print">) {
  const { id } = await params;
  await requireRole("doctor");
  const supabase = await createClient();

  // RLS: only the doctor of this visit gets a row back.
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, reason, status, patient_id, patient:profiles!appointments_patient_id_fkey(full_name, date_of_birth, sex), doctor:profiles!appointments_doctor_id_fkey(full_name, specialty), clinic:clinics(name), intake:intakes(answers, submitted_at), note:notes(content, edited_at), doctor_note:doctor_notes(body), summary:visit_summaries(body)",
    )
    .eq("id", id)
    .maybeSingle();
  const appt = data as unknown as Appt | null;
  if (!appt) notFound();

  const { data: cardRow } = await supabase
    .from("medical_cards")
    .select("allergies, medications, conditions")
    .eq("patient_id", appt.patient_id)
    .maybeSingle();
  const card = cardRow as MedicalCard | null;
  const note = appt.note?.content;
  const now = nowDate();

  return (
    <div className="flex-1 bg-white">
      <main className="mx-auto max-w-3xl px-6 py-10 text-ink print:max-w-none print:p-0 print:text-[11pt]">
        <div className="mb-8 flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div>
            <p className="text-sm text-muted">{appt.clinic?.name ?? "Clinic"} · Pre-visit note</p>
            <h1 className="text-2xl font-bold">{appt.patient?.full_name ?? "Patient"}</h1>
            <p className="text-sm">
              {[
                appt.patient?.date_of_birth ? `Born ${formatBirthDate(appt.patient.date_of_birth)}` : null,
                patientSummary(appt.patient, now),
              ]
                .filter(Boolean)
                .join(" · ") || "Date of birth and sex not given"}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{formatDateTime(appt.scheduled_at)}</p>
            <p>{appt.doctor?.full_name}</p>
            {appt.doctor?.specialty && <p className="text-muted">{appt.doctor.specialty}</p>}
            <div className="mt-3">
              <PrintButton />
            </div>
          </div>
        </div>

        {appt.reason && <Section title="Reason for booking">{appt.reason}</Section>}

        {note ? (
          <>
            {note.red_flags.length > 0 && (
              <Section title="Needs attention">
                <ul className="list-disc pl-5 font-semibold">
                  {note.red_flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Section>
            )}
            <Section title="Chief complaint">{note.chief_complaint}</Section>
            <Section title="History">{note.history}</Section>
            <div className="grid grid-cols-2 gap-6">
              <Section title="Medications">
                <Items items={note.medications} />
              </Section>
              <Section title="Allergies">
                <Items items={note.allergies} />
              </Section>
            </div>
            <Section title="Worth asking">
              <Items items={note.questions_for_doctor} />
            </Section>
          </>
        ) : (
          <Section title="Pre-visit note">No note yet — the patient hasn&apos;t sent answers.</Section>
        )}

        {card && CARD_FIELDS.some((f) => card[f.key]) && (
          <Section title="Medical card (kept by the patient)">
            <dl className="grid grid-cols-3 gap-4">
              {CARD_FIELDS.map((f) => (
                <div key={f.key}>
                  <dt className="text-xs text-muted">{f.label}</dt>
                  <dd>{card[f.key] || "—"}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {appt.intake && (
          <Section title="Patient's answers">
            <ol className="grid gap-2">
              {appt.intake.answers.map((a, i) => (
                <li key={i} className="break-inside-avoid">
                  <p className="text-xs text-muted">{a.question}</p>
                  <p>{a.answer || "—"}</p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {appt.summary && <Section title="Summary given to the patient"><p className="whitespace-pre-line">{appt.summary.body}</p></Section>}
        {appt.doctor_note?.body && <Section title="Doctor's notes"><p className="whitespace-pre-line">{appt.doctor_note.body}</p></Section>}

        <p className="mt-10 border-t border-line pt-3 text-xs text-muted">
          Printed {formatDateTime(now.toISOString())} from PreVisit. The note organizes what the patient reported; it is
          not a diagnosis. PreVisit is a portfolio demo.
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="mb-1 text-xs font-bold tracking-wide text-brand-dark uppercase print:text-ink">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Items({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-muted">None reported</span>;
  return (
    <ul className="list-disc pl-5">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}
