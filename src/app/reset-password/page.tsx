import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { isDemoEmail } from "@/lib/demo";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password — PreVisit" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const blocked = !user ? "expired" : isDemoEmail(user.email) ? "demo" : null;

  return (
    <main className="flex flex-1 items-center justify-center bg-soft px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(11,42,60,0.08)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Set a new password</h1>
          {blocked ? (
            <>
              <p className="mt-2 text-muted">
                {blocked === "demo"
                  ? "Demo accounts share one password and can't change it."
                  : "This reset link has expired or was opened in another browser."}
              </p>
              <Link
                href={blocked === "demo" ? "/login" : "/forgot-password"}
                className="mt-6 inline-block rounded-full bg-ink px-5 py-3 font-semibold text-white hover:bg-brand"
              >
                {blocked === "demo" ? "Back to sign in" : "Request a new link"}
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 mb-6 text-muted">For {user!.email}</p>
              <ResetForm />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
