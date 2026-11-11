import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, kyivDayOf, nowDate } from "@/lib/format";
import { ACTIONS, EVENT_SELECT, ROLE_LABEL, describeEvent, type VisitEvent } from "@/lib/events";
import { Empty, PageShell } from "@/components/page-shell";
import { AdminTabs } from "../admin-tabs";

export const metadata: Metadata = { title: "Activity — PreVisit" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "booked", label: "Booked" },
  { key: "rescheduled", label: "Rescheduled" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
  { key: "intake_submitted", label: "Answers" },
  { key: "note", label: "Notes" },
] as const;

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const sp = await searchParams;
  const type = typeof sp.type === "string" && FILTERS.some((f) => f.key === sp.type) ? sp.type : "";
  const profile = await requireRole("admin");
  const supabase = await createClient();

  // RLS: admins read their own clinic's history. Events are written only by database
  // triggers (migrations/007), so nothing here can be edited from the app.
  let query = supabase.from("appointment_events").select(EVENT_SELECT).lte("created_at", nowDate().toISOString());
  if (type === "note") query = query.in("action", ["note_created", "note_edited"]);
  else if (type) query = query.eq("action", type);
  const { data } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(80);
  const events = (data ?? []) as VisitEvent[];

  const now = nowDate();
  const groups: { day: string; label: string; items: VisitEvent[] }[] = [];
  for (const e of events) {
    const day = kyivDayOf(e.created_at);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(e);
    else groups.push({ day, label: formatDayLabel(e.created_at, now), items: [e] });
  }

  return (
    <PageShell profile={profile} title="Activity" subtitle="Who booked, moved, cancelled or completed a visit, and when.">
      <AdminTabs active="/admin/activity" />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/admin/activity?type=${f.key}` : "/admin/activity"}
            aria-current={f.key === type ? "true" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              f.key === type ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-brand"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <Empty>No activity yet.</Empty>
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-brand-dark uppercase">{g.label}</h2>
              <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {g.items.map((e) => {
                  const a = ACTIONS[e.action] ?? { label: e.action, dot: "bg-muted" };
                  return (
                    <li key={e.id} className="flex gap-4 px-5 py-3.5">
                      <span className="w-12 shrink-0 pt-0.5 text-sm text-muted tabular-nums">{formatTime(e.created_at)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-ink">
                          <span className="font-semibold">{e.actor_name}</span>
                          {e.actor_role && <span className="text-sm text-muted"> ({ROLE_LABEL[e.actor_role] ?? e.actor_role})</span>}{" "}
                          {describeEvent(e)}
                        </p>
                      </div>
                      <span className="hidden shrink-0 items-center gap-1.5 self-start rounded-full bg-soft px-3 py-1 text-xs font-medium text-muted sm:flex">
                        <span className={`size-2 rounded-full ${a.dot}`} aria-hidden />
                        {a.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {events.length === 80 && <p className="text-center text-sm text-muted">Showing the latest 80 events.</p>}
        </div>
      )}
    </PageShell>
  );
}
