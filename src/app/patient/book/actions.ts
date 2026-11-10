"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type BookState = { error?: string };

export async function bookVisit(doctorId: string, slot: string, _prev: BookState, formData: FormData): Promise<BookState> {
  await requireRole("patient");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  const supabase = await createClient();

  // book_slot() re-checks everything in the database: role, clinic, schedule, availability, limits.
  const { error } = await supabase.rpc("book_slot", { p_doctor: doctorId, p_at: slot, p_reason: reason });
  if (error) {
    return { error: error.code === "P0001" ? error.message : "Could not book this time. Please try another one." };
  }

  revalidatePath("/patient");
  revalidatePath("/doctor");
  revalidatePath("/admin");
  redirect("/patient?booked=1");
}

export async function cancelMyVisit(appointmentId: string): Promise<void> {
  await requireRole("patient");
  const supabase = await createClient();
  // RLS: patients can only delete their own future, not yet completed visits.
  await supabase.from("appointments").delete().eq("id", appointmentId);
  revalidatePath("/patient");
  revalidatePath("/doctor");
  revalidatePath("/admin");
}
