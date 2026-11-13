import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, pickLocale } from "./config";
import { messages } from "./messages";

/** UI language for this request: saved choice, else the browser's language. */
export const getLocale = cache(async () => {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
});

/** Messages for server components, route handlers and server actions. */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: messages(locale) };
}
