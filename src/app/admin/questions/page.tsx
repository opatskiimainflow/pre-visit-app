import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { AdminTabs } from "../admin-tabs";
import { QuestionEditor, type Question } from "./question-editor";

export const metadata: Metadata = { title: "Questionnaire — PreVisit" };

export default async function QuestionsPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  // RLS limits this to the admin's own clinic.
  const [{ data: clinic }, { data }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase.from("questions").select("id, position, text, kind, required").order("position"),
  ]);

  return (
    <PageShell profile={profile} title="Pre-visit questionnaire" subtitle={clinic?.name ?? "Your clinic"}>
      <AdminTabs active="/admin/questions" />
      <div className="max-w-3xl">
        <QuestionEditor questions={(data ?? []) as Question[]} />
      </div>
    </PageShell>
  );
}
