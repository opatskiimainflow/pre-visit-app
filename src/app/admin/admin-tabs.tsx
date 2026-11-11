import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Appointments" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/patients", label: "Patients" },
  { href: "/admin/doctors", label: "Doctors" },
  { href: "/admin/questions", label: "Questionnaire" },
  { href: "/admin/activity", label: "Activity" },
] as const;

export function AdminTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
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
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
