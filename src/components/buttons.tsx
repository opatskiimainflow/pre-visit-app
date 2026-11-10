"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type Variant } from "./button-styles";

/** Submit button that shows a spinner while its form's server action runs. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: Variant;
  size?: "sm" | "md";
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={buttonClass(variant, size)}>
      {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * Two-step destructive button: first click asks "Sure?", second click submits.
 * Avoids native confirm() dialogs.
 */
export function ConfirmSubmit({ children, confirmText = "Click again to confirm" }: { children: ReactNode; confirmText?: string }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={buttonClass("danger", "sm")}>
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="submit" disabled={pending} className={`${buttonClass("danger", "sm")} border-red-400 bg-red-50`}>
        {pending ? "…" : confirmText}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-sm text-muted hover:text-ink">
        Cancel
      </button>
    </span>
  );
}
