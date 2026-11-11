import Link from "next/link";

const TABS = [
  { href: "/doctor", label: "Upcoming" },
  { href: "/doctor/calendar", label: "Week calendar" },
] as const;

export function DoctorTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="mb-8 inline-flex gap-1 rounded-full border border-line bg-white p-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition sm:px-5 ${
            t.href === active ? "bg-ink text-white" : "text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
