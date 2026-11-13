"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "./config";

/** Saves the chosen UI language for a year and re-renders the current page. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
