"use client";

import { useActionState } from "react";
import { submitIntake, type IntakeState } from "./actions";

type Question = { id: string; text: string; kind: string; required: boolean };

export function QuestionnaireForm({ appointmentId, questions }: { appointmentId: string; questions: Question[] }) {
  const [state, action, pending] = useActionState<IntakeState, FormData>(
    submitIntake.bind(null, appointmentId),
    {},
  );
  const missing = new Set(state.missing ?? []);

  return (
    <form action={action} className="grid gap-5">
      {questions.map((q, i) => {
        const invalid = missing.has(q.id);
        const field = `rounded-xl border bg-white px-4 py-3 text-ink outline-none focus:border-brand ${
          invalid ? "border-red-400" : "border-line"
        }`;
        return (
          <fieldset key={q.id} className="rounded-2xl border border-line bg-white p-5">
            <legend className="sr-only">Question {i + 1}</legend>
            <label htmlFor={q.id} className="mb-3 block font-medium text-ink">
              <span className="mr-2 text-brand-dark">{i + 1}.</span>
              {q.text}
              {q.required && <span className="ml-1 text-red-500">*</span>}
            </label>

            {q.kind === "yes_no" ? (
              <div className="flex gap-3">
                {["Yes", "No"].map((v) => (
                  <label
                    key={v}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-5 py-2 has-checked:border-brand has-checked:bg-soft"
                  >
                    <input type="radio" name={q.id} value={v} className="accent-brand" />
                    {v}
                  </label>
                ))}
              </div>
            ) : q.kind === "long" ? (
              <textarea id={q.id} name={q.id} rows={3} maxLength={2000} className={`w-full ${field}`} />
            ) : (
              <input id={q.id} name={q.id} maxLength={500} className={`w-full ${field}`} />
            )}
            {invalid && <p className="mt-2 text-sm text-red-600">This question is required.</p>}
          </fieldset>
        );
      })}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        className="justify-self-start rounded-full bg-ink px-7 py-3.5 font-semibold text-white hover:bg-brand disabled:opacity-60"
      >
        {pending ? "Sending and preparing your note…" : "Send to my doctor"}
      </button>
      <p className="text-xs text-muted">
        Your answers go only to your clinic. An AI organizes them into a note for your doctor; it does not diagnose.
      </p>
    </form>
  );
}
