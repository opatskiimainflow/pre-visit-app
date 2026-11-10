"use client";

import { useActionState } from "react";
import { signIn, signInDemo, type LoginState } from "./actions";

const DEMO_ROLES = [
  { role: "patient", title: "Patient", text: "Fill in the pre-visit questionnaire" },
  { role: "doctor", title: "Doctor", text: "See today's appointments and AI notes" },
  { role: "admin", title: "Clinic admin", text: "Manage the clinic's questions" },
] as const;

export function DemoLogin() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInDemo, {});

  return (
    <div>
      <div className="grid gap-3">
        {DEMO_ROLES.map((r) => (
          <form key={r.role} action={action}>
            <input type="hidden" name="role" value={r.role} />
            <button
              disabled={pending}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-5 py-4 text-left transition hover:border-brand hover:shadow-sm disabled:opacity-60"
            >
              <span>
                <span className="block font-semibold text-ink">{r.title}</span>
                <span className="block text-sm text-muted">{r.text}</span>
              </span>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white">→</span>
            </button>
          </form>
        ))}
      </div>
      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </div>
  );
}

export function EmailLogin() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={action} className="grid gap-3">
      <input
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Email"
        className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
      />
      <button
        disabled={pending}
        className="rounded-full bg-ink px-5 py-3 font-semibold text-white hover:bg-brand disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
