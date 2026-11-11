import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/app-header";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account — PreVisit" };

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-soft px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(11,42,60,0.08)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Create a patient account</h1>
          <p className="mt-1 text-muted">
            Book a visit at the demo clinic under your own name and fill in the questionnaire.
          </p>
          <div className="mt-6">
            <SignupForm />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-dark hover:text-brand">
              Sign in
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Demo accounts and their visits are deleted every night. Please don&apos;t enter real health data.
        </p>
      </div>
    </main>
  );
}
