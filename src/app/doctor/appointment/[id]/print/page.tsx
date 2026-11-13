import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBirthDate, formatDateTime, nowDate, patientSummary } from "@/lib/format";
import { CARD_FIELDS, type MedicalCard } from "@/lib/medical-card";
import type { Answer, Note } from "@/lib/ai/note";
import { getT } from "@/lib/i18n/server";
import { PrintButton } from "./print-button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.doctor.printTitle };
}

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
  const { locale, t } = await getT();
  const d = t.doctor;

  return (
    <div className="flex-1 bg-white">
      <main className="mx-auto max-w-3xl px-6 py-10 text-ink print:max-w-none print:p-0 print:text-[11pt]">
        <div className="mb-8 flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div>
            <p className="text-sm text-muted">{appt.clinic?.name ?? t.common.clinic} · {d.printSub}</p>
            <h1 className="text-2xl font-bold">{appt.patient?.full_name ?? t.common.patient}</h1>
            <p className="text-sm">
              {[
                appt.patient?.date_of_birth ? d.born(formatBirthDate(appt.patient.date_of_birth, locale)) : null,
                patientSummary(appt.patient, now, locale),
              ]
                .filter(Boolean)
                .join(" · ") || d.noDobSex}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{formatDateTime(appt.scheduled_at, locale)}</p>
            <p>{appt.doctor?.full_name}</p>
            {appt.doctor?.specialty && <p className="text-muted">{appt.doctor.specialty}</p>}
            <div className="mt-3">
              <PrintButton />
            </div>
          </div>
        </div>

        {appt.reason && <Section title={d.reasonForBooking}>{appt.reason}</Section>}

        {note ? (
          <>
            {note.red_flags.length > 0 && (
              <Section title={d.needsAttention}>
                <ul className="list-disc pl-5 font-semibold">
                  {note.red_flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Section>
            )}
            <Section title={d.chiefComplaint}>{note.chief_complaint}</Section>
            <Section title={d.history}>{note.history}</Section>
            <div className="grid grid-cols-2 gap-6">
              <Section title={d.medications}>
                <Items items={note.medications} empty={t.common.noneReported} />
              </Section>
              <Section title={d.allergies}>
                <Items items={note.allergies} empty={t.common.noneReported} />
              </Section>
            </div>
            <Section title={d.worthAsking}>
              <Items items={note.questions_for_doctor} empty={t.common.noneReported} />
            </Section>
          </>
        ) : (
          <Section title={d.note}>{d.noNotePrint}</Section>
        )}

        {card && CARD_FIELDS.some((f) => card[f.key]) && (
          <Section title={d.cardByPatient}>
            <dl className="grid grid-cols-3 gap-4">
              {CARD_FIELDS.map((f) => (
                <div key={f.key}>
                  <dt className="text-xs text-muted">{t.patient.cardFields[f.key].label}</dt>
                  <dd>{card[f.key] || "—"}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {appt.intake && (
          <Section title={d.answers}>
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

        {appt.summary && <Section title={d.summaryGiven}><p className="whitespace-pre-line">{appt.summary.body}</p></Section>}
        {appt.doctor_note?.body && <Section title={d.doctorNotes}><p className="whitespace-pre-line">{appt.doctor_note.body}</p></Section>}

        <p className="mt-10 border-t border-line pt-3 text-xs text-muted">
          {d.printed(formatDateTime(now.toISOString(), locale))}
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

function Items({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <span className="text-muted">{empty}</span>;
  return (
    <ul className="list-disc pl-5">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}
