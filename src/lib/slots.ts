import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isoWeekday, kyivNextDays, nowDate } from "@/lib/format";

/**
 * A doctor's working days in the next two weeks with their free slots (ISO instants).
 * Free slots come from the free_slots() RPC, which hides who booked the taken ones.
 */
export async function loadFreeDays(supabase: SupabaseClient, doctorId: string, workdays: Set<number>) {
  const days = kyivNextDays(nowDate(), 14).filter((d) => workdays.has(isoWeekday(d)));
  const results = await Promise.all(days.map((d) => supabase.rpc("free_slots", { p_doctor: doctorId, p_day: d })));
  const slotsByDay = new Map<string, string[]>();
  days.forEach((d, i) =>
    slotsByDay.set(d, ((results[i].data ?? []) as string[]).map((s) => new Date(s).toISOString())),
  );
  const firstOpen = days.find((d) => (slotsByDay.get(d)?.length ?? 0) > 0) ?? days[0];
  return { days, slotsByDay, firstOpen };
}
