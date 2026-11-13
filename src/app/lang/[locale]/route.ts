import { NextResponse } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

/**
 * /lang/uk?next=/login — saves the UI language and continues to `next`.
 * Used by the marketing site so its Ukrainian pages open the app in Ukrainian.
 */
export async function GET(req: Request, ctx: RouteContext<"/lang/[locale]">) {
  const { locale } = await ctx.params;
  const url = new URL(req.url);
  const raw = url.searchParams.get("next") ?? "/login";
  // Only same-site paths, never "//host" or absolute URLs.
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/login";
  const res = NextResponse.redirect(new URL(next, url.origin));
  if (isLocale(locale)) {
    res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return res;
}
