"use client";

import { useActionState } from "react";
import { setNewPassword, type ResetState } from "./actions";

const input = "rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand";

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(setNewPassword, {});
  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1.5 text-sm text-muted">
        New password
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={input} />
      </label>
      <label className="grid gap-1.5 text-sm text-muted">
        Repeat new password
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={input} />
      </label>
      <button
        disabled={pending}
        className="mt-1 rounded-full bg-ink px-5 py-3 font-semibold text-white hover:bg-brand disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save new password"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
