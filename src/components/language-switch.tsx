import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/config";

const OPTIONS: { value: Locale; label: string; name: string }[] = [
  { value: "uk", label: "UA", name: "Українська" },
  { value: "en", label: "EN", name: "English" },
];

/** UA / EN toggle. A plain form, so it works before JavaScript loads. */
export function LanguageSwitch({ locale }: { locale: Locale }) {
  return (
    <div role="group" aria-label="Language / Мова" className="flex rounded-full border border-line bg-white p-0.5 text-xs font-semibold">
      {OPTIONS.map((o) => (
        <form key={o.value} action={setLocale.bind(null, o.value)}>
          <button
            lang={o.value}
            aria-label={o.name}
            aria-pressed={locale === o.value}
            className={`rounded-full px-2.5 py-1.5 ${
              locale === o.value ? "bg-ink text-white" : "text-muted hover:text-brand"
            }`}
          >
            {o.label}
          </button>
        </form>
      ))}
    </div>
  );
}
