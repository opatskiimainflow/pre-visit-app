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
    <nav className="mb-8 flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-white p-1 [scrollbar-width:none] sm:inline-flex">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`shrink-0 grow rounded-full px-3 py-2 text-center whitespace-nowrap sm:px-5 text-sm font-semibold transition ${
            t.href === active ? "bg-ink text-white" : "text-muted hover:text-ink"
          }`}
        >
          {labels[t.key]}
        </Link>
      ))}
    </nav>
  );
}
