"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/buttons";
import { bookAppointment, type BookState } from "./actions";

type Person = { id: string; full_name: string };

const field = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand";

export function BookForm({ patients, doctors, today }: { patients: Person[]; doctors: Person[]; today: string }) {
  const [state, action] = useActionState<BookState, FormData>(bookAppointment, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <h2 className="font-bold text-ink">Book a visit</h2>
      <label className="grid gap-1.5 text-sm text-muted">
        Patient
        <select name="patient_id" required defaultValue="" className={field}>
          <option value="" disabled>
            Choose a patient
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm text-muted">
        Doctor
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
          Date
          <input type="date" name="date" required min={today} defaultValue={today} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm text-muted">
          Time
          <input type="time" name="time" required step={900} defaultValue="10:00" className={field} />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm text-muted">
        Reason (optional)
        <input name="reason" maxLength={200} placeholder="e.g. Annual check-up" className={field} />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-dark">Visit booked. The patient can fill in the questionnaire now.</p>}
      <div>
        <SubmitButton pendingText="Booking…">Book visit</SubmitButton>
      </div>
      <p className="text-xs text-muted">Times are in clinic time (Kyiv).</p>
    </form>
  );
}
