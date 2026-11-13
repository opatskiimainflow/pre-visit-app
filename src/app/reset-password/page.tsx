import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { isDemoEmail } from "@/lib/demo";
import { getT } from "@/lib/i18n/server";
import { ResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.auth.resetTitle };
}

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const blocked = !user ? "expired" : isDemoEmail(user.email) ? "demo" : null;
  const { locale, t } = await getT();

  return (
    <AuthShell locale={locale} title={t.auth.resetHeading}>
      {blocked ? (
        <>
          <p className="mt-2 text-muted">{blocked === "demo" ? t.auth.demoNoChange : t.auth.resetExpired}</p>
          <Link
            href={blocked === "demo" ? "/login" : "/forgot-password"}
            className="mt-6 inline-block rounded-full bg-ink px-5 py-3 font-semibold text-white hover:bg-brand"
          >
            {blocked === "demo" ? t.auth.backToSignIn : t.auth.requestNewLink}
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 mb-6 text-muted">{t.auth.forEmail(user!.email ?? "")}</p>
          <ResetForm />
        </>
      )}
    </AuthShell>
  );
}
