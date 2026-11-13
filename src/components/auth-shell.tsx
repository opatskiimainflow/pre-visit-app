import type { ReactNode } from "react";
import { Logo } from "@/components/app-header";
import { LanguageSwitch } from "@/components/language-switch";
import type { Locale } from "@/lib/i18n/config";

/** Centered card used by sign-in, sign-up and password pages. */
export function AuthShell({
  locale,
  title,
  intro,
  children,
  footer,
  note,
}: {
  locale: Locale;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-soft px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Logo />
          <LanguageSwitch locale={locale} />
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(11,42,60,0.08)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {intro}
          {children}
          {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
        </div>
        {note && <p className="mt-6 text-center text-xs text-muted">{note}</p>}
      </div>
    </main>
  );
}
