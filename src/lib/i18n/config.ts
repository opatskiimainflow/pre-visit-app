/** UI languages. The clinic data itself (questions, notes) is stored as written. */
export const LOCALES = ["en", "uk"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const isLocale = (v: unknown): v is Locale => v === "en" || v === "uk";

/** BCP 47 tag for Intl formatting. */
export const intlLocale = (l: Locale) => (l === "uk" ? "uk-UA" : "en-GB");

/** Picks the UI language from the saved cookie, then from the browser's Accept-Language. */
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("uk") || first.startsWith("ru") ? "uk" : DEFAULT_LOCALE;
}

/**
 * Ukrainian plural form: 1 візит, 2 візити, 5 візитів, 21 візит.
 * forms = [one, few, many].
 */
export function pluralUk(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
