"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/buttons";
import { buttonClass } from "@/components/button-styles";
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
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<DetailsState, FormData>(async (prev, formData) => {
    const result = await saveMyDetails(prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, {});

  if (editing) {
    return (
      <form action={action} className="grid gap-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-bold text-ink">My details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-muted">
            Date of birth
            <input type="date" name="date_of_birth" min="1900-01-01" max={today} defaultValue={dob ?? ""} className={field} />
          </label>
          <fieldset className="grid gap-1.5 text-sm text-muted">
            <legend className="mb-1.5">Sex</legend>
            <div className="flex gap-2">
              {(["female", "male"] as const).map((v) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-ink has-checked:border-brand has-checked:bg-soft"
                >
                  <input type="radio" name="sex" value={v} defaultChecked={sex === v} className="accent-brand" />
                  {v === "female" ? "Female" : "Male"}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex gap-2">
          <SubmitButton size="sm" pendingText="Saving…">
            Save
          </SubmitButton>
          <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
            Cancel
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
        <p className="text-sm text-muted">My details</p>
        {missing ? (
          <p className="font-semibold text-ink">Add your date of birth and sex so your doctor can prepare.</p>
        ) : (
          <p className="font-semibold text-ink">
            {birthDate} <span className="font-normal text-muted">· {summary}</span>
          </p>
        )}
        {state.ok && <p className="mt-1 text-sm text-brand-dark">Saved. Your doctor will see this before the visit.</p>}
      </div>
      <button type="button" onClick={() => setEditing(true)} className={buttonClass(missing ? "brand" : "ghost", "sm")}>
        {missing ? "Add details" : "Edit"}
      </button>
    </div>
  );
}
