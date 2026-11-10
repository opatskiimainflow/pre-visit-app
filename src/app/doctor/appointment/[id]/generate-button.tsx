"use client";

import { useActionState } from "react";
import { generateNoteAction, type GenerateState } from "./actions";

export function GenerateNoteButton({ appointmentId }: { appointmentId: string }) {
  const [state, action, pending] = useActionState<GenerateState>(
    () => generateNoteAction(appointmentId),
    {},
  );

  return (
    <form action={action}>
      <button
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {pending ? "Preparing note…" : "Generate AI note"}
      </button>
      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
