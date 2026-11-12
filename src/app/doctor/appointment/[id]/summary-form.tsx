"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/buttons";
import { saveSummary, type SaveState } from "./actions";

/** What the patient takes home. Unlike "My notes", the patient sees this after the visit. */
export function SummaryForm({ appointmentId, body, completed }: { appointmentId: string; body: string; completed: boolean }) {
  const [state, action] = useActionState<SaveState, FormData>(saveSummary.bind(null, appointmentId), {});

  return (
    <form action={action} className="rounded-2xl border border-brand/40 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-ink">Summary for the patient</h2>
        <span className="text-xs text-muted">
          {completed ? "Visible to the patient" : "The patient sees it once the visit is completed"}
        </span>
      </div>
      <textarea
        name="summary"
        defaultValue={body}
        rows={4}
        maxLength={3000}
        placeholder={"Recommendations in plain words, e.g.\n• Take ibuprofen no more than 3 days a week\n• Come back in 2 weeks if it doesn't improve"}
        className="mt-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
      />
      <div className="mt-3 flex items-center gap-3">
        <SubmitButton size="sm" variant="brand" pendingText="Saving…">
          Save summary
        </SubmitButton>
        {state.ok && <span className="text-sm text-brand-dark">Saved</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
