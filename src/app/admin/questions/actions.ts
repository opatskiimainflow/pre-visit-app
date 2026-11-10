"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: boolean };

const KINDS = ["short", "long", "yes_no"] as const;

function readQuestion(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  const kind = String(formData.get("kind") ?? "short");
  const required = formData.get("required") === "on";
  if (text.length < 3) return { error: "Write the question (at least 3 characters)." } as const;
  if (text.length > 300) return { error: "Keep the question under 300 characters." } as const;
  if (!KINDS.includes(kind as (typeof KINDS)[number])) return { error: "Unknown answer type." } as const;
  return { text, kind, required } as const;
}

function done() {
  revalidatePath("/admin/questions");
  return { ok: true };
}

export async function addQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole("admin");
  const q = readQuestion(formData);
  if ("error" in q) return { error: q.error };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("questions")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  // RLS: admins can only insert questions into their own clinic.
  const { error } = await supabase
    .from("questions")
    .insert({ ...q, clinic_id: profile.clinic_id, position: (last?.position ?? 0) + 1 });
  return error ? { error: "Could not add the question." } : done();
}

export async function updateQuestion(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const q = readQuestion(formData);
  if ("error" in q) return { error: q.error };

  const supabase = await createClient();
  const { error } = await supabase.from("questions").update(q).eq("id", id);
  return error ? { error: "Could not save the question." } : done();
}

export async function deleteQuestion(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("questions").delete().eq("id", id);
  revalidatePath("/admin/questions");
}

/** Swaps the question with its neighbour above (-1) or below (+1). */
export async function moveQuestion(id: string, direction: -1 | 1): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("questions").select("id, position").order("position");
  const list = data ?? [];
  const i = list.findIndex((q) => q.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;

  const a = list[i];
  const b = list[j];
  await supabase.from("questions").update({ position: b.position }).eq("id", a.id);
  await supabase.from("questions").update({ position: a.position }).eq("id", b.id);
  revalidatePath("/admin/questions");
}
