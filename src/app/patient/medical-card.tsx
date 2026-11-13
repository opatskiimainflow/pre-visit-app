"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/buttons";
import { buttonClass } from "@/components/button-styles";
import { CARD_FIELDS, type MedicalCard } from "@/lib/medical-card";
import { useT } from "@/lib/i18n/client";
import { saveMedicalCard, type CardState } from "./actions";

const area = "w-full rounded-xl border border-line bg-white px-3 py-2 text-ink outline-none focus:border-brand";

/** Allergies, medications and chronic conditions, kept between visits. */
export function MedicalCardPanel({ card, updated }: { card: MedicalCard | null; updated: string | null }) {
  const { t } = useT();
  const p = t.patient;
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<CardState, FormData>(async (prev, formData) => {
    const result = await saveMedicalCard(prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, {});
  const empty = !card || CARD_FIELDS.every((f) => !card[f.key]);

  if (editing) {
    return (
      <form action={action} className="grid gap-4 rounded-2xl border border-line bg-white p-5">
        <div>
          <h2 className="font-bold text-ink">{p.medicalCard}</h2>
          <p className="text-sm text-muted">{p.medicalCardHint}</p>
        </div>
        {CARD_FIELDS.map((f) => (
          <label key={f.key} className="grid gap-1.5 text-sm text-muted">
            {p.cardFields[f.key].label}
            <textarea
              name={f.key}
              rows={2}
              maxLength={1000}
              defaultValue={card?.[f.key] ?? ""}
              placeholder={p.cardFields[f.key].placeholder}
              className={area}
            />
          </label>
        ))}
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
    <div className={`rounded-2xl border bg-white p-5 ${empty ? "border-brand/40" : "border-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{p.medicalCard}</p>
          {empty ? (
            <p className="font-semibold text-ink">{p.medicalCardEmpty}</p>
          ) : (
            updated && <p className="text-xs text-muted">{p.updated(updated)}</p>
          )}
        </div>
        <button type="button" onClick={() => setEditing(true)} className={buttonClass(empty ? "brand" : "ghost", "sm")}>
          {empty ? p.fillIn : t.common.edit}
        </button>
      </div>
      {!empty && (
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {CARD_FIELDS.map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className="text-xs font-semibold tracking-wide text-brand-dark uppercase">{p.cardFields[f.key].label}</dt>
              <dd className="mt-0.5 text-sm break-words text-ink">{card?.[f.key] || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      {state.ok && <p className="mt-2 text-sm text-brand-dark">{p.cardSaved}</p>}
    </div>
  );
}
