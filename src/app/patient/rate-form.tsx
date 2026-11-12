"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/buttons";
import { rateVisit, type RateState } from "./actions";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** 1–5 stars and an optional comment, once per completed visit. */
export function RateForm({ appointmentId }: { appointmentId: string }) {
  const [state, action] = useActionState<RateState, FormData>(rateVisit.bind(null, appointmentId), {});
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || stars;

  return (
    <form action={action} className="grid gap-3">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">How was your visit?</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name="stars"
                value={n}
                checked={stars === n}
                onChange={() => setStars(n)}
                className="peer sr-only"
              />
              <span
                className={`block rounded px-0.5 text-3xl leading-none peer-focus-visible:outline-2 peer-focus-visible:outline-brand ${
                  n <= shown ? "text-amber-500" : "text-line"
                }`}
                aria-hidden
              >
                ★
              </span>
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"}
              </span>
            </label>
          ))}
          <span className="ml-2 text-sm text-muted">{LABELS[shown]}</span>
        </div>
      </fieldset>
      {stars > 0 && (
        <>
          <textarea
            name="comment"
            rows={2}
            maxLength={1000}
            placeholder="Anything to add? (optional)"
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
          <div>
            <SubmitButton size="sm" pendingText="Sending…">
              Send rating
            </SubmitButton>
          </div>
        </>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
