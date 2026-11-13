import Link from "next/link";
import { signOut } from "@/app/login/actions";
import type { Profile } from "@/lib/auth";
import { LanguageSwitch } from "@/components/language-switch";
import { getT } from "@/lib/i18n/server";

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

export async function AppHeader({ profile }: { profile: Profile }) {
  const { locale, t } = await getT();
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-ink">{profile.full_name}</p>
            <p className="text-xs text-muted">{t.common.roles[profile.role]}</p>
          </div>
          <LanguageSwitch locale={locale} />
          <form action={signOut}>
            <button className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand">
              {t.common.signOut}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
