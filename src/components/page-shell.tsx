import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import type { Profile } from "@/lib/auth";

export function PageShell({
  profile,
  title,
  subtitle,
  children,
}: {
  profile: Profile;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-soft">
      <AppHeader profile={profile} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-line bg-white p-6">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-muted">
      {children}
    </div>
  );
}
