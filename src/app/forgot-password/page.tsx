import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/app-header";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password — PreVisit" };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const expired = (await searchParams).expired === "1";
  return (
    <main className="flex flex-1 items-center justify-center bg-soft px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(11,42,60,0.08)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Forgot your password?</h1>
          <p className="mt-1 mb-6 text-muted">Enter the email you signed up with and we&apos;ll send you a reset link.</p>
          {expired && (
            <p role="alert" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              That link has expired or was already used. Request a new one.
            </p>
          )}
          <ForgotForm />
          <p className="mt-6 text-center text-sm text-muted">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-brand-dark hover:text-brand">
              Sign in
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Demo note: this project uses Supabase&apos;s free mailer, which only delivers to the project team.
        </p>
      </div>
    </main>
  );
}
