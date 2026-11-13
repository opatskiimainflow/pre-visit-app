"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/buttons";
import { bookAppointment, type BookState } from "./actions";
import { useT } from "@/lib/i18n/client";

type Person = { id: string; full_name: string };

const field = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand";

export function BookForm({ patients, doctors, today }: { patients: Person[]; doctors: Person[]; today: string }) {
  const [state, action] = useActionState<BookState, FormData>(bookAppointment, {});
  const formRef = useRef<HTMLFormElement>(null);
  const b = useT().t.admin.book;

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <h2 className="font-bold text-ink">{b.heading}</h2>
      <label className="grid gap-1.5 text-sm text-muted">
        {b.patient}
        <select name="patient_id" required defaultValue="" className={field}>
          <option value="" disabled>
            {b.choosePatient}
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm text-muted">
        {b.doctor}
        <select name="doctor_id" required defaultValue={doctors[0]?.id ?? ""} className={field}>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-sm text-muted">
          {b.date}
          <input type="date" name="date" required min={today} defaultValue={today} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm text-muted">
          {b.time}
          <input type="time" name="time" required step={900} defaultValue="10:00" className={field} />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm text-muted">
        {b.reason}
        <input name="reason" maxLength={200} placeholder={b.reasonPlaceholder} className={field} />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-dark">{b.ok}</p>}
      <div>
        <SubmitButton pendingText={b.pending}>{b.submit}</SubmitButton>
      </div>
      <p className="text-xs text-muted">{b.hint}</p>
    </form>
  );
}
