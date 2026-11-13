"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/buttons";
import { useT } from "@/lib/i18n/client";
import { rescheduleVisit, type RescheduleState } from "./actions";

export function RescheduleForm({ appointmentId, slot }: { appointmentId: string; slot: string }) {
  const { t } = useT();
  const [state, action] = useActionState<RescheduleState, FormData>(
    () => rescheduleVisit(appointmentId, slot),
    {},
  );
  return (
    <form action={action} className="grid gap-3">
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <SubmitButton variant="brand" pendingText={t.patient.moving}>
          {t.patient.confirmNewTime}
        </SubmitButton>
      </div>
    </form>
  );
}
