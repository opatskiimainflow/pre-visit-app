import type { Locale } from "./config";

/** English and Ukrainian side by side; Ukrainian must have exactly the same keys. */
export function defineMessages<T>(m: { en: T; uk: NoInfer<T> }): Record<Locale, T> {
  return m;
}
