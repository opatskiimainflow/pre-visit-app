import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { AdminTabs } from "../admin-tabs";
import { QuestionEditor, type Question } from "./question-editor";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.admin.questionsTitle };
}

export default async function QuestionsPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  // RLS limits this to the admin's own clinic.
  const [{ data: clinic }, { data }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase.from("questions").select("id, position, text, text_uk, kind, required, parent_id, prefill").order("position"),
  ]);

  const { t } = await getT();

  return (
    <PageShell profile={profile} title={t.admin.questionsHeading} subtitle={clinic?.name ?? t.admin.yourClinic}>
      <AdminTabs active="/admin/questions" />
      <div className="max-w-3xl">
        <QuestionEditor questions={(data ?? []) as Question[]} />
      </div>
    </PageShell>
  );
}
