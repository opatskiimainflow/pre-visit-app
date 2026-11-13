"use client";

import { useActionState, useState, type ReactNode } from "react";
import { SubmitButton } from "@/components/buttons";
import { buttonClass } from "@/components/button-styles";
import type { Note } from "@/lib/ai/note";
import { useT } from "@/lib/i18n/client";
import { saveNote, type SaveState } from "./actions";

type Props = {
  appointmentId: string;
  note: Note;
  badge: ReactNode;
  editedAt: string | null;
  canEdit: boolean;
};

const area = "w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand";

export function NoteCard({ appointmentId, note, badge, editedAt, canEdit }: Props) {
  const { t } = useT();
  const d = t.doctor;
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<SaveState, FormData>(async (prev, formData) => {
    const result = await saveNote(appointmentId, prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, {});

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-ink">{d.note}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {editedAt ? (
            <span className="rounded-full bg-soft px-3 py-1 text-xs font-medium text-brand-dark">{d.reviewed}</span>
          ) : (
            badge
          )}
          {canEdit && !editing && (
            <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost", "sm")}>
              {t.common.edit}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <form action={action} className="mt-5 grid gap-4">
          <EditField label={d.chiefComplaint}>
            <textarea name="chief_complaint" defaultValue={note.chief_complaint} rows={2} className={area} />
          </EditField>
          <EditField label={d.history}>
            <textarea name="history" defaultValue={note.history} rows={4} className={area} />
          </EditField>
          {(
            [
              ["red_flags", d.needsAttention],
              ["medications", d.medications],
              ["allergies", d.allergies],
              ["questions_for_doctor", d.worthAsking],
            ] as const
          ).map(([key, label]) => (
            <EditField key={key} label={label} hint={d.onePerLine}>
              <textarea name={key} defaultValue={note[key].join("\n")} rows={3} className={area} />
            </EditField>
          ))}
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex gap-2">
            <SubmitButton pendingText={t.common.saving}>{d.saveNote}</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost")}>
              {t.common.cancel}
            </button>
          </div>
        </form>
      ) : (
        <>
          {note.red_flags.length > 0 && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">{d.needsAttention}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
                {note.red_flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          <dl className="mt-5 grid gap-5">
            <Field label={d.chiefComplaint}>{note.chief_complaint}</Field>
            <Field label={d.history}>{note.history}</Field>
            <Field label={d.medications}>
              <List items={note.medications} empty={t.common.noneReported} />
            </Field>
            <Field label={d.allergies}>
              <List items={note.allergies} empty={t.common.noneReported} />
            </Field>
            <Field label={d.worthAsking}>
              <List items={note.questions_for_doctor} empty="—" />
            </Field>
          </dl>
          <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
            {d.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}

function EditField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-brand-dark uppercase">
        {label}
        {hint && <span className="ml-2 font-normal normal-case text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-brand-dark uppercase">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <span className="text-muted">{empty}</span>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}
