"use client";

import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/buttons";
import { buttonClass } from "@/components/button-styles";
import { formatDay } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import {
  addDoctor,
  addTimeOff,
  deleteTimeOff,
  saveDoctor,
  setDoctorActive,
  type DoctorFormState,
  type TimeOffState,
} from "./actions";

export type Hours = { weekday: number; start_time: string; end_time: string; slot_minutes: number };
export type TimeOff = { id: string; start_date: string; end_date: string; note: string };
export type Doctor = {
  id: string;
  full_name: string;
  specialty: string | null;
  active: boolean;
  hours: Hours[];
  timeOff: TimeOff[];
};

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
  const D = useT().t.admin.doctors;

  return (
    // @container: the form sits both in a wide card and in the narrow sidebar,
    // so the layout follows the form's own width, not the viewport.
    <div className="@container grid gap-4">
      <div className="grid gap-3 @md:grid-cols-2">
        <label className="grid gap-1.5 text-sm text-muted">
          {D.fullName}
          <input name="full_name" required minLength={3} maxLength={80} defaultValue={doctor?.full_name} placeholder={D.namePlaceholder} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm text-muted">
          {D.specialty}
          <input name="specialty" maxLength={80} defaultValue={doctor?.specialty ?? ""} placeholder={D.specialtyPlaceholder} className={field} />
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm text-muted">{D.hours}</legend>
        {D.days.map((name, i) => {
          const day = i + 1;
          const h = byDay.get(day);
          return (
            <div key={day} className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 @md:grid-cols-[8rem_9rem_auto_9rem] @md:justify-start">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name={`day_${day}`} defaultChecked={Boolean(h)} className="size-4 accent-brand" />
                <span className="@md:hidden">{D.short[i]}</span>
                <span className="hidden @md:inline">{name}</span>
              </label>
              <input type="time" name={`start_${day}`} step={900} defaultValue={hhmm(h?.start_time ?? "09:00")} className={timeField} aria-label={D.start(name)} />
              <span className="text-muted">–</span>
              <input type="time" name={`end_${day}`} step={900} defaultValue={hhmm(h?.end_time ?? "17:00")} className={timeField} aria-label={D.end(name)} />
            </div>
          );
        })}
      </fieldset>

      <label className="flex items-center gap-3 text-sm text-muted">
        {D.visitLength}
        <select name="slot" defaultValue={String(slot)} className={field}>
          {[15, 20, 30, 45, 60].map((m) => (
            <option key={m} value={m}>
              {m} {D.min}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

type DoctorTexts = Messages["admin"]["doctors"];

function hoursSummary(hours: Hours[], D: DoctorTexts) {
  if (!hours.length) return D.noHours;
  return [...hours]
    .sort((a, b) => a.weekday - b.weekday)
    .map((h) => `${D.short[h.weekday - 1]} ${hhmm(h.start_time)}–${hhmm(h.end_time)}`)
    .join(" · ");
}

const rangeLabel = (t: TimeOff, locale: Locale) =>
  t.start_date === t.end_date
    ? formatDay(t.start_date, locale)
    : `${formatDay(t.start_date, locale)} – ${formatDay(t.end_date, locale)}`;

/** Upcoming days off and a small form to add more. */
function TimeOffPanel({ doctor, today }: { doctor: Doctor; today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const { locale, t } = useT();
  const D = t.admin.doctors;
  const [state, action] = useActionState<TimeOffState, FormData>(async (prev, formData) => {
    const result = await addTimeOff(doctor.id, prev, formData);
    if (result.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
    return result;
  }, {});

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{D.timeOff}</p>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-brand-dark hover:text-brand">
            {D.addDaysOff}
          </button>
        )}
      </div>
      {doctor.timeOff.length === 0 && !open && <p className="text-xs text-muted">{D.noDaysOff}</p>}
      {doctor.timeOff.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {doctor.timeOff.map((t) => (
            <li key={t.id} className="flex items-center gap-1.5 rounded-full bg-amber-50 py-1 pr-1 pl-3 text-xs text-amber-900 ring-1 ring-amber-200">
              <span>
                <span className="font-semibold">{rangeLabel(t, locale)}</span>
                {t.note && <span> · {t.note}</span>}
              </span>
              <form action={deleteTimeOff.bind(null, t.id)}>
                <button aria-label={D.removeTimeOff(rangeLabel(t, locale))} className="grid size-5 place-items-center rounded-full hover:bg-amber-200">
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <form ref={formRef} action={action} className="@container mt-3 grid gap-2">
          <div className="grid gap-2 @md:grid-cols-[1fr_1fr_1.4fr]">
            <label className="grid gap-1 text-xs text-muted">
              {D.firstDay}
              <input type="date" name="start_date" required min={today} defaultValue={today} className={field} />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              {D.lastDay}
              <input type="date" name="end_date" min={today} className={field} />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              {D.note}
              <input name="note" maxLength={120} placeholder={D.notePlaceholder} className={field} />
            </label>
          </div>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex gap-2">
            <SubmitButton size="sm" pendingText={t.common.saving}>
              {D.saveDaysOff}
            </SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>
              {t.common.cancel}
            </button>
          </div>
        </form>
      )}
      {state.warning && <p className="mt-2 text-sm text-amber-800">{state.warning}</p>}
    </div>
  );
}

export function DoctorCard({ doctor, today }: { doctor: Doctor; today: string }) {
  const [editing, setEditing] = useState(false);
  const { t } = useT();
  const D = t.admin.doctors;
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
            <SubmitButton size="sm" pendingText={t.common.saving}>
              {t.common.save}
            </SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
              {t.common.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {doctor.full_name}
              {!doctor.active && (
                <span className="ml-2 rounded-full bg-soft px-2.5 py-0.5 text-xs font-medium text-muted">{D.inactive}</span>
              )}
            </p>
            <p className="text-sm text-muted">{doctor.specialty ?? D.noSpecialty}</p>
            <p className="mt-2 text-xs text-muted">
              {hoursSummary(doctor.hours, D)}
              {doctor.hours[0] ? ` · ${D.minVisits(doctor.hours[0].slot_minutes)}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost", "sm")}>
              {t.common.edit}
            </button>
            <form action={setDoctorActive.bind(null, doctor.id, !doctor.active)}>
              <SubmitButton size="sm" variant={doctor.active ? "danger" : "ghost"} pendingText="…">
                {doctor.active ? D.deactivate : D.activate}
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
      {!editing && doctor.active && <TimeOffPanel doctor={doctor} today={today} />}
    </div>
  );
}

export function AddDoctorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const D = useT().t.admin.doctors;
  const [state, action] = useActionState<DoctorFormState, FormData>(async (prev, formData) => {
    const result = await addDoctor(prev, formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <h2 className="font-bold text-ink">{D.addHeading}</h2>
      <DoctorFields />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-dark">{D.added}</p>}
      <div>
        <SubmitButton pendingText={D.adding}>{D.add}</SubmitButton>
      </div>
      <p className="text-xs text-muted">{D.addHint}</p>
    </form>
  );
}
