import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { kyivDayOf, kyivToday, formatTime, nowDate } from "@/lib/format";
import { EVENT_SELECT, describeEvent, type VisitEvent } from "@/lib/events";
import { getT } from "@/lib/i18n/server";

type Visit = {
  scheduled_at: string;
  reason: string | null;
  status: string;
  completed_at: string | null;
  patient: { full_name: string; date_of_birth: string | null; sex: string | null } | null;
  doctor: { full_name: string } | null;
  intake: { submitted_at: string } | null;
  rating: { stars: number; comment: string } | null;
};

/** /admin/export/visits and /admin/export/activity — CSV for the admin's own clinic (RLS). */
export async function GET(_req: Request, ctx: RouteContext<"/admin/export/[kind]">) {
  const { kind } = await ctx.params;
  const profile = await getProfile();
  const { locale, t } = await getT();
  const C = t.admin.csv;
  if (!profile || profile.role !== "admin") return new Response(C.onlyAdmins, { status: 403 });
  const supabase = await createClient();
  const stamp = kyivToday(nowDate());
  let csv: string;

  if (kind === "visits") {
    const { data } = await supabase
      .from("appointments")
      .select(
        "scheduled_at, reason, status, completed_at, patient:profiles!appointments_patient_id_fkey(full_name, date_of_birth, sex), doctor:profiles!appointments_doctor_id_fkey(full_name), intake:intakes(submitted_at), rating:visit_ratings(stars, comment)",
      )
      .order("scheduled_at", { ascending: false })
      .limit(5000);
    const rows = ((data ?? []) as unknown as Visit[]).map((v) => [
      kyivDayOf(v.scheduled_at),
      formatTime(v.scheduled_at, locale),
      v.patient?.full_name,
      v.patient?.date_of_birth,
      v.patient?.sex === "female" || v.patient?.sex === "male" ? t.common.sex[v.patient.sex] : v.patient?.sex,
      v.doctor?.full_name,
      v.reason,
      C.statuses[v.status] ?? v.status,
      v.intake ? C.yes : C.no,
      v.rating?.stars,
      v.rating?.comment,
    ]);
    csv = toCsv(C.visits, rows);
  } else if (kind === "activity") {
    const { data } = await supabase
      .from("appointment_events")
      .select(EVENT_SELECT)
      .lte("created_at", nowDate().toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    const rows = ((data ?? []) as VisitEvent[]).map((e) => [
      kyivDayOf(e.created_at),
      formatTime(e.created_at, locale),
      e.actor_name,
      t.events.roles[e.actor_role ?? "system"] ?? e.actor_role,
      t.events.labels[e.action] ?? e.action,
      `${e.actor_name} ${describeEvent(e, true, locale)}`,
      e.patient_name,
      e.doctor_name,
    ]);
    csv = toCsv(C.activity, rows);
  } else {
    return new Response(t.common.notFound, { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="previsit-${kind}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
