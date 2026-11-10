"use client";

import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/buttons";
import { buttonClass } from "@/components/button-styles";
import { addDoctor, saveDoctor, setDoctorActive, type DoctorFormState } from "./actions";

export type Hours = { weekday: number; start_time: string; end_time: string; slot_minutes: number };
export type Doctor = { id: string; full_name: string; specialty: string | null; active: boolean; hours: Hours[] };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hhmm = (t: string) => t.slice(0, 5);
const field = "min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-ink outline-none focus:border-brand";
const timeField = "w-full min-w-0 rounded-xl border border-line bg-white px-2 py-1.5 [&::-webkit-calendar-picker-indicator]:hidden @md:[&::-webkit-calendar-picker-indicator]:block text-sm text-ink outline-none focus:border-brand";

const DEFAULT_HOURS: Hours[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  start_time: "09:00",
  end_time: "17:00",
  slot_minutes: 30,
}));

/** Name, specialty and a 7-day schedule. Field names are read by actions.ts. */
function DoctorFields({ doctor }: { doctor?: Doctor }) {
  const hours = doctor?.hours ?? DEFAULT_HOURS;
  const byDay = new Map(hours.map((h) => [h.weekday, h]));
  const slot = hours[0]?.slot_minutes ?? 30;

  return (
    // @container: the form sits both in a wide card and in the narrow sidebar,
    // so the layout follows the form's own width, not the viewport.
    <div className="@container grid gap-4">
      <div className="grid gap-3 @md:grid-cols-2">
        <label className="grid gap-1.5 text-sm text-muted">
          Full name
          <input name="full_name" required minLength={3} maxLength={80} defaultValue={doctor?.full_name} placeholder="Dr. Iryna Koval" className={field} />
        </label>
        <label className="grid gap-1.5 text-sm text-muted">
          Specialty
          <input name="specialty" maxLength={80} defaultValue={doctor?.specialty ?? ""} placeholder="e.g. Dermatology" className={field} />
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm text-muted">Working hours (clinic time)</legend>
        {DAYS.map((name, i) => {
          const day = i + 1;
          const h = byDay.get(day);
          return (
            <div key={day} className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 @md:grid-cols-[8rem_9rem_auto_9rem] @md:justify-start">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name={`day_${day}`} defaultChecked={Boolean(h)} className="size-4 accent-brand" />
                <span className="@md:hidden">{SHORT[i]}</span>
                <span className="hidden @md:inline">{name}</span>
              </label>
              <input type="time" name={`start_${day}`} step={900} defaultValue={hhmm(h?.start_time ?? "09:00")} className={timeField} aria-label={`${name} start`} />
              <span className="text-muted">–</span>
              <input type="time" name={`end_${day}`} step={900} defaultValue={hhmm(h?.end_time ?? "17:00")} className={timeField} aria-label={`${name} end`} />
            </div>
          );
        })}
      </fieldset>

      <label className="flex items-center gap-3 text-sm text-muted">
        Visit length
        <select name="slot" defaultValue={String(slot)} className={field}>
          {[15, 20, 30, 45, 60].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function hoursSummary(hours: Hours[]) {
  if (!hours.length) return "No working hours";
  return [...hours]
    .sort((a, b) => a.weekday - b.weekday)
    .map((h) => `${SHORT[h.weekday - 1]} ${hhmm(h.start_time)}–${hhmm(h.end_time)}`)
    .join(" · ");
}

export function DoctorCard({ doctor }: { doctor: Doctor }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<DoctorFormState, FormData>(async (prev, formData) => {
    const result = await saveDoctor(doctor.id, prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, {});

  return (
    <div className={`rounded-2xl border bg-white p-5 ${doctor.active ? "border-line" : "border-dashed border-line opacity-75"}`}>
      {editing ? (
        <form action={action} className="grid gap-4">
          <DoctorFields doctor={doctor} />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex gap-2">
            <SubmitButton size="sm" pendingText="Saving…">
              Save
            </SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {doctor.full_name}
              {!doctor.active && (
                <span className="ml-2 rounded-full bg-soft px-2.5 py-0.5 text-xs font-medium text-muted">Inactive</span>
              )}
            </p>
            <p className="text-sm text-muted">{doctor.specialty ?? "No specialty set"}</p>
            <p className="mt-2 text-xs text-muted">
              {hoursSummary(doctor.hours)}
              {doctor.hours[0] ? ` · ${doctor.hours[0].slot_minutes} min visits` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost", "sm")}>
              Edit
            </button>
            <form action={setDoctorActive.bind(null, doctor.id, !doctor.active)}>
              <SubmitButton size="sm" variant={doctor.active ? "danger" : "ghost"} pendingText="…">
                {doctor.active ? "Deactivate" : "Activate"}
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function AddDoctorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<DoctorFormState, FormData>(async (prev, formData) => {
    const result = await addDoctor(prev, formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <h2 className="font-bold text-ink">Add a doctor</h2>
      <DoctorFields />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-dark">Doctor added. Patients can book them right away.</p>}
      <div>
        <SubmitButton pendingText="Adding…">Add doctor</SubmitButton>
      </div>
      <p className="text-xs text-muted">The doctor gets a profile without a login. Email invitations are not part of this demo.</p>
    </form>
  );
}
