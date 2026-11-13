"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { signIn, signInDemo, type LoginState } from "./actions";

const DEMO_ROLES = ["patient", "doctor", "admin"] as const;

export function DemoLogin() {
  const { t } = useT();
  const [state, action, pending] = useActionState<LoginState, FormData>(signInDemo, {});

  return (
    <div>
      <div className="grid gap-3">
        {DEMO_ROLES.map((role) => (
          <form key={role} action={action}>
            <input type="hidden" name="role" value={role} />
            <button
              disabled={pending}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-5 py-4 text-left transition hover:border-brand hover:shadow-sm disabled:opacity-60"
            >
              <span>
                <span className="block font-semibold text-ink">{t.auth.demoRoles[role].title}</span>
                <span className="block text-sm text-muted">{t.auth.demoRoles[role].text}</span>
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
  const { t } = useT();
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={action} className="grid gap-3">
      <input
        name="email"
        type="email"
        autoComplete="email"
        placeholder={t.auth.email}
        className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder={t.auth.password}
        className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
      />
      <button
        disabled={pending}
        className="rounded-full bg-ink px-5 py-3 font-semibold text-white hover:bg-brand disabled:opacity-60"
      >
        {pending ? t.auth.signingIn : t.auth.signIn}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Link href="/forgot-password" className="justify-self-center text-sm text-muted hover:text-brand">
        {t.auth.forgot}
      </Link>
    </form>
  );
}
