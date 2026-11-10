"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/buttons";
import { bookVisit, type BookState } from "./actions";

export function ConfirmForm({ doctorId, slot }: { doctorId: string; slot: string }) {
  const [state, action] = useActionState<BookState, FormData>(bookVisit.bind(null, doctorId, slot), {});

  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1.5 text-sm text-muted">
        What is the visit about? (optional)
        <input
          name="reason"
          maxLength={200}
          placeholder="e.g. Persistent cough"
          className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <SubmitButton variant="brand" pendingText="Booking…">
          Confirm booking
        </SubmitButton>
      </div>
    </form>
  );
}
