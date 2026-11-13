"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/buttons";
import { buttonClass } from "@/components/button-styles";
import { useT } from "@/lib/i18n/client";
import { saveMyDetails, type DetailsState } from "./actions";

const field = "rounded-xl border border-line bg-white px-3 py-2 text-ink outline-none focus:border-brand";

/**
 * "My details": date of birth and sex, shown to the patient's doctor and used in the
 * pre-visit note. `summary` and `birthDate` are formatted on the server.
 */
export function DetailsCard({
  dob,
  sex,
  summary,
  birthDate,
  today,
}: {
  dob: string | null;
  sex: string | null;
  summary: string | null;
  birthDate: string | null;
  today: string;
}) {
  const missing = !dob || !sex;
  const { t } = useT();
  const p = t.patient;
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<DetailsState, FormData>(async (prev, formData) => {
    const result = await saveMyDetails(prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, {});

  if (editing) {
    return (
      <form action={action} className="grid gap-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-bold text-ink">{p.myDetails}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-muted">
            {p.dob}
            <input type="date" name="date_of_birth" min="1900-01-01" max={today} defaultValue={dob ?? ""} className={field} />
          </label>
          <fieldset className="grid gap-1.5 text-sm text-muted">
            <legend className="mb-1.5">{p.sex}</legend>
            <div className="flex gap-2">
              {(["female", "male"] as const).map((v) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-ink has-checked:border-brand has-checked:bg-soft"
                >
                  <input type="radio" name="sex" value={v} defaultChecked={sex === v} className="accent-brand" />
                  {t.common.sex[v]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex gap-2">
          <SubmitButton size="sm" pendingText={t.common.saving}>
            {t.common.save}
          </SubmitButton>
          <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
            {t.common.cancel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5 ${
        missing ? "border-brand/40" : "border-line"
      }`}
    >
      <div>
        <p className="text-sm text-muted">{p.myDetails}</p>
        {missing ? (
          <p className="font-semibold text-ink">{p.addDetailsPrompt}</p>
        ) : (
          <p className="font-semibold text-ink">
            {birthDate} <span className="font-normal text-muted">· {summary}</span>
          </p>
        )}
        {state.ok && <p className="mt-1 text-sm text-brand-dark">{p.detailsSaved}</p>}
      </div>
      <button type="button" onClick={() => setEditing(true)} className={buttonClass(missing ? "brand" : "ghost", "sm")}>
        {missing ? p.addDetails : t.common.edit}
      </button>
    </div>
  );
}
