import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n/server";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.auth.signupTitle };
}

export default async function SignupPage() {
  const { locale, t } = await getT();
  return (
    <AuthShell
      locale={locale}
      title={t.auth.signupHeading}
      intro={<p className="mt-1 text-muted">{t.auth.signupIntro}</p>}
      footer={
        <>
          {t.auth.haveAccount}{" "}
          <Link href="/login" className="font-semibold text-brand-dark hover:text-brand">
            {t.auth.signIn}
          </Link>
        </>
      }
      note={t.auth.signupNote}
    >
      <div className="mt-6">
        <SignupForm />
      </div>
    </AuthShell>
  );
}
