import type { Metadata } from "next";
import localFont from "next/font/local";
import { SessionRefresher } from "@/components/session-refresher";
import "./globals.css";

// Inter (variable, latin), bundled with the app so builds don't need Google Fonts.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PreVisit — AI pre-visit notes for clinics",
  description:
    "PreVisit turns a short patient questionnaire into a structured note for the doctor, ready before the appointment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SessionRefresher />
        {children}
      </body>
    </html>
  );
}
