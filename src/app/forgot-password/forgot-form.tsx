"use client";

import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { requestReset, type ForgotState } from "./actions";

export function ForgotForm() {
  const { t } = useT();
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestReset, {});

  if (state.sent) {
    return (
      <div role="status" className="rounded-2xl border border-brand/30 bg-soft p-5">
        <p className="font-semibold text-ink">{t.auth.checkInbox}</p>
        <p className="mt-1 text-sm text-muted">{t.auth.sentTo(state.email ?? "")}</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1.5 text-sm text-muted">
        {t.auth.email}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand"
        />
      </label>
      <button
        disabled={pending}
        className="mt-1 rounded-full bg-ink px-5 py-3 font-semibold text-white hover:bg-brand disabled:opacity-60"
      >
        {pending ? t.common.sending : t.auth.sendLink}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
