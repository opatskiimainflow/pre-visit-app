import Link from "next/link";
import { getT } from "@/lib/i18n/server";

const TABS = [
  { href: "/doctor", key: "upcoming" },
  { href: "/doctor/calendar", key: "calendar" },
] as const;

export async function DoctorTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  const labels = (await getT()).t.doctor.tabs;
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
          {labels[t.key]}
        </Link>
      ))}
    </nav>
  );
}
