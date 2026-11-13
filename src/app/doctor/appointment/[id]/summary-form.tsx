"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/buttons";
import { useT } from "@/lib/i18n/client";
import { saveSummary, type SaveState } from "./actions";

/** What the patient takes home. Unlike "My notes", the patient sees this after the visit. */
export function SummaryForm({ appointmentId, body, completed }: { appointmentId: string; body: string; completed: boolean }) {
  const { t } = useT();
  const d = t.doctor;
  const [state, action] = useActionState<SaveState, FormData>(saveSummary.bind(null, appointmentId), {});

  return (
    <form action={action} className="rounded-2xl border border-brand/40 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-ink">{d.summaryTitle}</h2>
        <span className="text-xs text-muted">
          {completed ? d.summaryVisible : d.summaryLater}
        </span>
      </div>
      <textarea
        name="summary"
        defaultValue={body}
        rows={4}
        maxLength={3000}
        placeholder={d.summaryPlaceholder}
        className="mt-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
      />
      <div className="mt-3 flex items-center gap-3">
        <SubmitButton size="sm" variant="brand" pendingText={t.common.saving}>
          {d.saveSummary}
        </SubmitButton>
        {state.ok && <span className="text-sm text-brand-dark">{t.common.saved}</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
