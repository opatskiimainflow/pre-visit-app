"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { dbMessage } from "@/lib/i18n/messages/db";
import type { Messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/config";

export type FormState = { error?: string; ok?: boolean };

const KINDS = ["short", "long", "yes_no"] as const;
const PREFILL = ["allergies", "medications", "conditions"];

function readQuestion(formData: FormData, e: Messages["admin"]["questionErrors"]) {
  const text = String(formData.get("text") ?? "").trim();
  const text_uk = String(formData.get("text_uk") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "short");
  const required = formData.get("required") === "on";
  if (text.length < 3) return { error: e.short } as const;
  if (text.length > 300 || (text_uk?.length ?? 0) > 300) return { error: e.long } as const;
  if (!KINDS.includes(kind as (typeof KINDS)[number])) return { error: e.kind } as const;
  // Empty = a regular question. The database checks the parent is a yes/no question of this clinic.
  const parent_id = String(formData.get("parent_id") ?? "") || null;
  const prefillRaw = String(formData.get("prefill") ?? "");
  const prefill = PREFILL.includes(prefillRaw) ? prefillRaw : null;
  return { text, text_uk, kind, required, parent_id, prefill } as const;
}

/** P0001 messages come from the database check on follow-ups and are safe to show. */
function failure(error: { code?: string; message: string }, fallback: string, locale: Locale) {
  return { error: error.code === "P0001" ? dbMessage(error.message, locale) : fallback };
}

function done() {
  revalidatePath("/admin/questions");
  return { ok: true };
}

export async function addQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole("admin");
  const { locale, t } = await getT();
  const e = t.admin.questionErrors;
  const q = readQuestion(formData, e);
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
  return error ? failure(error, e.addFailed, locale) : done();
}

export async function updateQuestion(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const { locale, t } = await getT();
  const e = t.admin.questionErrors;
  const q = readQuestion(formData, e);
  if ("error" in q) return { error: q.error };

  const supabase = await createClient();
  const { error } = await supabase.from("questions").update(q).eq("id", id);
  return error ? failure(error, e.saveFailed, locale) : done();
}

export async function deleteQuestion(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("questions").delete().eq("id", id);
  revalidatePath("/admin/questions");
}

/** Swaps the question with its neighbour above (-1) or below (+1) among questions on the same level. */
export async function moveQuestion(id: string, direction: -1 | 1): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("questions").select("id, position, parent_id").order("position");
  const all = data ?? [];
  const me = all.find((q) => q.id === id);
  if (!me) return;
  // Follow-ups move within their question; top-level questions move with their follow-ups.
  const list = all.filter((q) => q.parent_id === me.parent_id);
  const i = list.findIndex((q) => q.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;

  const a = list[i];
  const b = list[j];
  await supabase.from("questions").update({ position: b.position }).eq("id", a.id);
  await supabase.from("questions").update({ position: a.position }).eq("id", b.id);
  revalidatePath("/admin/questions");
}
