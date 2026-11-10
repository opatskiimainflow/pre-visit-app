import type { Metadata } from "next";
import { Logo } from "@/components/app-header";
import { DemoLogin, EmailLogin } from "./login-forms";

export const metadata: Metadata = { title: "Sign in — PreVisit" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-soft px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(11,42,60,0.08)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Try the live demo</h1>
          <p className="mt-1 text-muted">Pick a role. All patients in the demo are fictional.</p>
          <div className="mt-6">
            <DemoLogin />
          </div>
          <div className="my-6 flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" />
            or sign in with email
            <span className="h-px flex-1 bg-line" />
          </div>
          <EmailLogin />
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Portfolio demo. Not a medical device and does not provide diagnoses.
        </p>
      </div>
    </main>
  );
}
