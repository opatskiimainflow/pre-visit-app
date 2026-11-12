"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ConfirmSubmit, SubmitButton } from "@/components/buttons";
import { buttonClass } from "@/components/button-styles";
import { addQuestion, deleteQuestion, moveQuestion, updateQuestion, type FormState } from "./actions";

import { CARD_LABEL, isCardField, orderQuestions } from "@/lib/medical-card";

export type Question = {
  id: string;
  position: number;
  text: string;
  kind: string;
  required: boolean;
  parent_id: string | null;
  prefill: string | null;
};

const KIND_LABEL: Record<string, string> = { short: "Short answer", long: "Long answer", yes_no: "Yes / no" };
const select = "rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const short = (t: string) => (t.length > 48 ? `${t.slice(0, 46)}…` : t);

/**
 * `parents`: top-level yes/no questions this one can follow up on.
 * A question that already has follow-ups can't become one itself (one level only).
 */
function QuestionFields({ q, parents, hasChildren }: { q?: Question; parents: Question[]; hasChildren?: boolean }) {
  const options = parents.filter((p) => p.id !== q?.id);
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
          className={select}
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm text-muted">
          Show
          <select name="parent_id" defaultValue={q?.parent_id ?? ""} disabled={hasChildren} className={select}>
            <option value="">Always</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                Only after “Yes” to: {short(p.text)}
              </option>
            ))}
          </select>
          {hasChildren && <span className="text-xs">This question has follow-ups, so it is always shown.</span>}
        </label>
        <label className="grid gap-1.5 text-sm text-muted">
          Pre-fill from the patient&apos;s medical card
          <select name="prefill" defaultValue={q?.prefill ?? ""} className={select}>
            <option value="">No</option>
            {Object.entries(CARD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function QuestionRow({
  q,
  label,
  first,
  last,
  parents,
  hasChildren,
}: {
  q: Question;
  label: string;
  first: boolean;
  last: boolean;
  parents: Question[];
  hasChildren: boolean;
}) {
  const followUp = Boolean(q.parent_id);
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
          <QuestionFields q={q} parents={parents} hasChildren={hasChildren} />
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
    <li className={`flex flex-wrap items-start gap-4 py-4 ${followUp ? "pl-6 sm:pl-12" : ""}`}>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold ${
          followUp ? "border border-brand/40 text-brand-dark" : "bg-soft text-brand-dark"
        }`}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{q.text}</p>
        <p className="text-sm text-muted">
          {followUp ? "Follow-up, shown after “Yes” · " : ""}
          {KIND_LABEL[q.kind] ?? q.kind}
          {q.required ? " · required" : " · optional"}
          {isCardField(q.prefill) ? ` · pre-filled: ${CARD_LABEL[q.prefill].toLowerCase()}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={moveQuestion.bind(null, q.id, -1)}>
          <button disabled={first} aria-label="Move up" className={buttonClass("ghost", "sm")}>
            ↑
          </button>
        </form>
        <form action={moveQuestion.bind(null, q.id, 1)}>
          <button disabled={last} aria-label="Move down" className={buttonClass("ghost", "sm")}>
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

function AddQuestion({ parents }: { parents: Question[] }) {
  const [state, action] = useActionState<FormState, FormData>(addQuestion, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <h2 className="font-bold text-ink">Add a question</h2>
      <QuestionFields parents={parents} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <SubmitButton pendingText="Adding…">Add question</SubmitButton>
      </div>
    </form>
  );
}

export function QuestionEditor({ questions }: { questions: Question[] }) {
  const ordered = orderQuestions(questions);
  const parents = ordered.filter((q) => q.kind === "yes_no" && !q.parent_id);
  const withChildren = new Set(questions.map((q) => q.parent_id).filter(Boolean));
  const siblings = (q: Question) => ordered.filter((o) => o.parent_id === q.parent_id);
  let n = 0;
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-line bg-white px-6 py-2">
        {questions.length === 0 ? (
          <p className="py-6 text-center text-muted">No questions yet. Add the first one below.</p>
        ) : (
          <ol className="divide-y divide-line">
            {ordered.map((q) => {
              const level = siblings(q);
              if (!q.parent_id) n++;
              return (
                <QuestionRow
                  key={q.id}
                  q={q}
                  label={q.parent_id ? "↳" : String(n)}
                  first={level[0]?.id === q.id}
                  last={level[level.length - 1]?.id === q.id}
                  parents={parents}
                  hasChildren={withChildren.has(q.id)}
                />
              );
            })}
          </ol>
        )}
      </div>
      <div className="rounded-2xl border border-line bg-white p-6">
        <AddQuestion parents={parents} />
      </div>
      <p className="text-xs text-muted">
        Changes apply to questionnaires filled from now on. Answers already sent keep their original questions. A
        follow-up appears right under its question, only when the patient answers “Yes”.
      </p>
    </div>
  );
}
