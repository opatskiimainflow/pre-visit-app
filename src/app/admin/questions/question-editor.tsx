"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ConfirmSubmit, SubmitButton } from "@/components/buttons";
import { buttonClass } from "@/components/button-styles";
import { addQuestion, deleteQuestion, moveQuestion, updateQuestion, type FormState } from "./actions";

export type Question = { id: string; position: number; text: string; kind: string; required: boolean };

const KIND_LABEL: Record<string, string> = { short: "Short answer", long: "Long answer", yes_no: "Yes / no" };

function QuestionFields({ q }: { q?: Question }) {
  return (
    <div className="grid gap-3">
      <textarea
        name="text"
        defaultValue={q?.text}
        required
        rows={2}
        maxLength={300}
        placeholder="e.g. Do you smoke? How much per day?"
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
      />
      <div className="flex flex-wrap items-center gap-4">
        <select
          name="kind"
          defaultValue={q?.kind ?? "short"}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        >
          {Object.entries(KIND_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="required" defaultChecked={q?.required ?? true} className="size-4 accent-brand" />
          Required
        </label>
      </div>
    </div>
  );
}

function QuestionRow({ q, index, total }: { q: Question; index: number; total: number }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await updateQuestion(q.id, prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, {});

  if (editing) {
    return (
      <li className="py-4">
        <form action={action} className="grid gap-3">
          <QuestionFields q={q} />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex gap-2">
            <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-start gap-4 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-soft text-sm font-semibold text-brand-dark">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{q.text}</p>
        <p className="text-sm text-muted">
          {KIND_LABEL[q.kind] ?? q.kind}
          {q.required ? " · required" : " · optional"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={moveQuestion.bind(null, q.id, -1)}>
          <button disabled={index === 0} aria-label="Move up" className={buttonClass("ghost", "sm")}>
            ↑
          </button>
        </form>
        <form action={moveQuestion.bind(null, q.id, 1)}>
          <button disabled={index === total - 1} aria-label="Move down" className={buttonClass("ghost", "sm")}>
            ↓
          </button>
        </form>
        <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost", "sm")}>
          Edit
        </button>
        <form action={deleteQuestion.bind(null, q.id)}>
          <ConfirmSubmit confirmText="Delete">Delete</ConfirmSubmit>
        </form>
      </div>
    </li>
  );
}

function AddQuestion() {
  const [state, action] = useActionState<FormState, FormData>(addQuestion, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <h2 className="font-bold text-ink">Add a question</h2>
      <QuestionFields />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <SubmitButton pendingText="Adding…">Add question</SubmitButton>
      </div>
    </form>
  );
}

export function QuestionEditor({ questions }: { questions: Question[] }) {
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-line bg-white px-6 py-2">
        {questions.length === 0 ? (
          <p className="py-6 text-center text-muted">No questions yet. Add the first one below.</p>
        ) : (
          <ol className="divide-y divide-line">
            {questions.map((q, i) => (
              <QuestionRow key={q.id} q={q} index={i} total={questions.length} />
            ))}
          </ol>
        )}
      </div>
      <div className="rounded-2xl border border-line bg-white p-6">
        <AddQuestion />
      </div>
      <p className="text-xs text-muted">
        Changes apply to questionnaires filled from now on. Answers already sent keep their original questions.
      </p>
    </div>
  );
}
