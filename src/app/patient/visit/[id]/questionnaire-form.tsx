"use client";

import { useActionState, useState } from "react";
import { isCardField, visibleQuestions, type MedicalCard, type Question } from "@/lib/medical-card";
import { submitIntake, type IntakeState } from "./actions";

export function QuestionnaireForm({
  appointmentId,
  questions,
  card,
}: {
  appointmentId: string;
  questions: Question[];
  card: MedicalCard | null;
}) {
  const [state, action, pending] = useActionState<IntakeState, FormData>(
    submitIntake.bind(null, appointmentId),
    {},
  );
  // Answers to yes/no questions decide which follow-ups appear.
  const [yesNo, setYesNo] = useState<Record<string, string>>({});
  const missing = new Set(state.missing ?? []);
  const shown = visibleQuestions(questions, (id) => yesNo[id] === "Yes");
  const hasPrefill = questions.some((q) => isCardField(q.prefill));
  let number = 0;

  return (
    <form action={action} className="grid gap-5">
      {card && hasPrefill && (
        <p className="rounded-2xl border border-brand/30 bg-white p-4 text-sm text-ink">
          Some answers are already filled in from your medical card. Check that they are still correct.
        </p>
      )}

      {shown.map((q) => {
        const followUp = Boolean(q.parent_id);
        if (!followUp) number++;
        const invalid = missing.has(q.id);
        const prefilled = card && isCardField(q.prefill) ? card[q.prefill] : "";
        const initial = state.values?.[q.id] ?? prefilled;
        const field = `rounded-xl border bg-white px-4 py-3 text-ink outline-none focus:border-brand ${
          invalid ? "border-red-400" : "border-line"
        }`;
        return (
          <fieldset
            key={q.id}
            className={`rounded-2xl border bg-white p-5 ${
              followUp ? "-mt-3 ml-4 animate-[fade-in_200ms_ease-out] border-brand/40 sm:ml-8" : "border-line"
            }`}
          >
            <legend className="sr-only">{followUp ? "Follow-up question" : `Question ${number}`}</legend>
            <label htmlFor={q.id} className="mb-3 block font-medium text-ink">
              <span className="mr-2 text-brand-dark">{followUp ? "↳" : `${number}.`}</span>
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
                    <input
                      type="radio"
                      name={q.id}
                      value={v}
                      checked={yesNo[q.id] === v}
                      onChange={() => setYesNo((s) => ({ ...s, [q.id]: v }))}
                      className="accent-brand"
                    />
                    {v}
                  </label>
                ))}
              </div>
            ) : q.kind === "long" ? (
              <textarea id={q.id} name={q.id} rows={3} maxLength={2000} defaultValue={initial} className={`w-full ${field}`} />
            ) : (
              <input id={q.id} name={q.id} maxLength={500} defaultValue={initial} className={`w-full ${field}`} />
            )}
            {prefilled && initial === prefilled && <p className="mt-2 text-xs text-brand-dark">From your medical card</p>}
            {invalid && <p className="mt-2 text-sm text-red-600">This question is required.</p>}
          </fieldset>
        );
      })}

      {hasPrefill && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="save_card" defaultChecked className="size-4 accent-brand" />
          Save my allergies, medications and conditions to my medical card for next time
        </label>
      )}

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
