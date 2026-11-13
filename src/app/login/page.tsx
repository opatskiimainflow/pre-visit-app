import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n/server";
import { DemoLogin, EmailLogin } from "./login-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.auth.loginTitle };
}

export default async function LoginPage() {
  const { locale, t } = await getT();
  return (
    <AuthShell
      locale={locale}
      title={t.auth.tryDemo}
      intro={<p className="mt-1 text-muted">{t.auth.pickRole}</p>}
      footer={
        <>
          {t.auth.newHere}{" "}
          <Link href="/signup" className="font-semibold text-brand-dark hover:text-brand">
            {t.auth.createPatientAccount}
          </Link>
        </>
      }
      note={t.auth.portfolioNote}
    >
      <div className="mt-6">
        <DemoLogin />
      </div>
      <div className="my-6 flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" />
        {t.auth.orEmail}
        <span className="h-px flex-1 bg-line" />
      </div>
      <EmailLogin />
    </AuthShell>
  );
}
