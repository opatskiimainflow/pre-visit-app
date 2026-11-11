"use client";

import { useActionState } from "react";
import { signUp, type SignupState } from "./actions";

const input = "rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand";

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signUp, {});

  return (
    // key: remount with the values the server sent back, so a failed attempt keeps them.
    <form key={`${state.email}-${state.fullName}-${state.error}`} action={action} className="grid gap-3">
      <label className="grid gap-1.5 text-sm text-muted">
        Full name
        <input
          name="full_name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={state.fullName}
          className={input}
        />
      </label>
      <label className="grid gap-1.5 text-sm text-muted">
        Email
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className={input} />
      </label>
      <label className="grid gap-1.5 text-sm text-muted">
        Password
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={input} />
        <span className="text-xs">At least 8 characters.</span>
      </label>
      <button
        disabled={pending}
        className="mt-2 rounded-full bg-ink px-5 py-3 font-semibold text-white hover:bg-brand disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
