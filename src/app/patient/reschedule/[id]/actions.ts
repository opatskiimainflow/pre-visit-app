"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RescheduleState = { error?: string };

export async function rescheduleVisit(appointmentId: string, slot: string): Promise<RescheduleState> {
  await requireRole("patient");
  const supabase = await createClient();
  // reschedule_visit() checks ownership, status, the doctor's schedule and that the slot is free.
  const { error } = await supabase.rpc("reschedule_visit", { p_appt: appointmentId, p_at: slot });
  if (error) {
    return { error: error.code === "P0001" ? `${error.message}.` : "Could not move the visit. Please try again." };
  }
  revalidatePath("/patient");
  revalidatePath("/doctor", "layout");
  revalidatePath("/admin", "layout");
  redirect("/patient?moved=1");
}
