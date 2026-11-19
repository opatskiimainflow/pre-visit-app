import Link from "next/link";
import { getT } from "@/lib/i18n/server";

const TABS = [
  { href: "/admin", key: "appointments" },
  { href: "/admin/analytics", key: "analytics" },
  { href: "/admin/patients", key: "patients" },
  { href: "/admin/doctors", key: "doctors" },
  { href: "/admin/questions", key: "questions" },
  { href: "/admin/activity", key: "activity" },
] as const;

export async function AdminTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  const labels = (await getT()).t.admin.tabs;
  return (
    <nav className="mb-8 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-white p-1 sm:inline-flex sm:max-w-full sm:rounded-full">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`min-w-0 truncate rounded-full px-2 py-2 text-center whitespace-nowrap sm:shrink-0 sm:grow sm:px-5 text-sm font-semibold transition ${
            t.href === active ? "bg-ink text-white" : "text-muted hover:text-ink"
          }`}
        >
          {labels[t.key]}
        </Link>
      ))}
    </nav>
  );
}
