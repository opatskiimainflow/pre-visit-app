"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/buttons";
import { useT } from "@/lib/i18n/client";
import { saveDoctorNotes, type SaveState } from "./actions";

export function DoctorNotes({ appointmentId, body }: { appointmentId: string; body: string }) {
  const { t } = useT();
  const d = t.doctor;
  const [state, action] = useActionState<SaveState, FormData>(saveDoctorNotes.bind(null, appointmentId), {});

  return (
    <form action={action} className="rounded-2xl border border-line bg-white p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold text-ink">{d.myNotes}</h2>
        <span className="text-xs text-muted">{d.private}</span>
      </div>
      <textarea
        name="body"
        defaultValue={body}
        rows={5}
        maxLength={5000}
        placeholder={d.notesPlaceholder}
        className="mt-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
      />
      <div className="mt-3 flex items-center gap-3">
        <SubmitButton size="sm" pendingText={t.common.saving}>
          {d.saveNotes}
        </SubmitButton>
        {state.ok && <span className="text-sm text-brand-dark">{t.common.saved}</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
