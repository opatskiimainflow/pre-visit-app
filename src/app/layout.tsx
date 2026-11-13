import type { Metadata } from "next";
import localFont from "next/font/local";
import { SessionRefresher } from "@/components/session-refresher";
import { I18nProvider } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";
import "./globals.css";

// Inter (variable), bundled with the app so builds don't need Google Fonts.
// Latin and Cyrillic are separate files; the font stack falls back glyph by glyph.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
const interCyrillic = localFont({
  src: "./fonts/inter-cyrillic-wght-normal.woff2",
  variable: "--font-inter-cyrillic",
  weight: "100 900",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.common.appTitle, description: t.common.appDescription };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getT();
  return (
    <html lang={locale} className={`${inter.variable} ${interCyrillic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SessionRefresher />
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
