import Link from "next/link";
import { signOut } from "@/app/login/actions";
import type { Profile } from "@/lib/auth";

const ROLE_LABEL = { patient: "Patient", doctor: "Doctor", admin: "Clinic admin" };

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-[9px] bg-brand text-xl font-bold leading-none text-white">
        +
      </span>
      <span className="text-xl font-bold tracking-tight text-ink">PreVisit</span>
    </Link>
  );
}

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-ink">{profile.full_name}</p>
            <p className="text-xs text-muted">{ROLE_LABEL[profile.role]}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
