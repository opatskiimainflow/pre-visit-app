import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n/server";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.auth.forgotTitle };
}

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const expired = (await searchParams).expired === "1";
  const { locale, t } = await getT();
  return (
    <AuthShell
      locale={locale}
      title={t.auth.forgotHeading}
      intro={<p className="mt-1 mb-6 text-muted">{t.auth.forgotIntro}</p>}
      footer={
        <>
          {t.auth.remembered}{" "}
          <Link href="/login" className="font-semibold text-brand-dark hover:text-brand">
            {t.auth.signIn}
          </Link>
        </>
      }
      note={t.auth.mailerNote}
    >
      {expired && (
        <p role="alert" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t.auth.linkExpired}
        </p>
      )}
      <ForgotForm />
    </AuthShell>
  );
}
