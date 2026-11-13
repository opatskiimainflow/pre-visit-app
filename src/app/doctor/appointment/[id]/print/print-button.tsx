"use client";

import { useT } from "@/lib/i18n/client";

export function PrintButton() {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand print:hidden"
    >
      {t.doctor.printButton}
    </button>
  );
}
