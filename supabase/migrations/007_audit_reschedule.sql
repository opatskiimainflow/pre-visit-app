-- PreVisit migration 007: audit log of visit changes + patient rescheduling.
-- Run once in Supabase → SQL Editor (after 006), then re-run seed.sql. Safe to run again.

-- ─── Audit log ───────────────────────────────────────────────────────────
-- One row per change to a visit. Written only by database triggers, never by the app,
-- so the history cannot be edited or skipped from the client.
-- appointment_id/patient_id/doctor_id have no foreign keys on purpose: a cancelled
-- (deleted) visit keeps its history. Names and time are copied for the same reason.
create table if not exists public.appointment_events (
  id             bigint generated always as identity primary key,
  clinic_id      uuid not null references public.clinics (id) on delete cascade,
  appointment_id uuid,
  patient_id     uuid,
  doctor_id      uuid,
  actor_id       uuid,
  actor_name     text not null default 'System',
  actor_role     text,
  action         text not null check (action in (
                   'booked', 'cancelled', 'rescheduled', 'completed', 'reopened',
                   'intake_submitted', 'note_created', 'note_edited')),
  patient_name   text,
  doctor_name    text,
  scheduled_at   timestamptz,
  details        jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index if not exists appointment_events_clinic_time on public.appointment_events (clinic_id, created_at desc);
create index if not exists appointment_events_appointment on public.appointment_events (appointment_id, created_at);

alter table public.appointment_events enable row level security;
revoke all on public.appointment_events from anon, authenticated;
grant select on public.appointment_events to authenticated;

-- Admins see their clinic's history; doctors see the history of their own visits.
drop policy if exists "admin reads clinic events" on public.appointment_events;
create policy "admin reads clinic events" on public.appointment_events
  for select to authenticated
  using (clinic_id = public.my_clinic() and public.my_role() = 'admin');

drop policy if exists "doctor reads own visit events" on public.appointment_events;
create policy "doctor reads own visit events" on public.appointment_events
  for select to authenticated
  using (doctor_id = auth.uid());

-- Writes one event. auth.uid() is the signed-in user who made the change (null for
-- cron / SQL editor → "System"). The demo reset turns logging off for its own writes.
create or replace function public.log_visit_event(
  p_appt public.appointments, p_action text, p_details jsonb default '{}'
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.profiles;
begin
  if coalesce(current_setting('previsit.skip_audit', true), '') = 'on' then
    return;
  end if;
  -- During a cascading delete of the whole clinic there is nothing left to log into.
  if not exists (select 1 from public.clinics where id = p_appt.clinic_id) then
    return;
  end if;

  select * into v_actor from public.profiles where id = auth.uid();

  insert into public.appointment_events (
    clinic_id, appointment_id, patient_id, doctor_id, actor_id, actor_name, actor_role,
    action, patient_name, doctor_name, scheduled_at, details)
  values (
    p_appt.clinic_id, p_appt.id, p_appt.patient_id, p_appt.doctor_id,
    v_actor.id, coalesce(v_actor.full_name, 'System'), v_actor.role,
    p_action,
    (select full_name from public.profiles where id = p_appt.patient_id),
    (select full_name from public.profiles where id = p_appt.doctor_id),
    p_appt.scheduled_at, coalesce(p_details, '{}'));
end $$;

revoke all on function public.log_visit_event(public.appointments, text, jsonb) from public, anon, authenticated;

create or replace function public.audit_appointments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_visit_event(new, 'booked',
      jsonb_build_object('reason', new.reason));
  elsif tg_op = 'DELETE' then
    perform public.log_visit_event(old, 'cancelled', '{}');
  else
    if new.scheduled_at is distinct from old.scheduled_at then
      perform public.log_visit_event(new, 'rescheduled',
        jsonb_build_object('from', old.scheduled_at, 'to', new.scheduled_at));
    end if;
    if new.status is distinct from old.status then
      perform public.log_visit_event(new,
        case when new.status = 'completed' then 'completed' else 'reopened' end, '{}');
    end if;
  end if;
  return null;
end $$;

create or replace function public.audit_intakes_notes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = new.appointment_id;
  if v_appt.id is null then
    return null;
  end if;
  if tg_table_name = 'intakes' then
    perform public.log_visit_event(v_appt, 'intake_submitted', '{}');
  elsif tg_op = 'INSERT' then
    perform public.log_visit_event(v_appt, 'note_created', jsonb_build_object('model', new.model));
  elsif new.content is distinct from old.content then
    perform public.log_visit_event(v_appt, 'note_edited', '{}');
  end if;
  return null;
end $$;

revoke all on function public.audit_appointments() from public, anon, authenticated;
revoke all on function public.audit_intakes_notes() from public, anon, authenticated;

drop trigger if exists audit_appointments on public.appointments;
create trigger audit_appointments
  after insert or update or delete on public.appointments
  for each row execute function public.audit_appointments();

drop trigger if exists audit_intakes on public.intakes;
create trigger audit_intakes
  after insert on public.intakes
  for each row execute function public.audit_intakes_notes();

drop trigger if exists audit_notes on public.notes;
create trigger audit_notes
  after insert or update on public.notes
  for each row execute function public.audit_intakes_notes();

-- ─── Rescheduling ────────────────────────────────────────────────────────
-- A patient moves their own upcoming visit to another free slot of the same doctor
-- (an admin can do the same for any visit in their clinic). The answers and the note
-- stay with the visit. Same checks as booking: schedule, 30-day window, slot free.
create or replace function public.reschedule_visit(p_appt uuid, p_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appt;

  if v_appt.id is null
     or not (v_appt.patient_id = auth.uid()
             or (public.my_role() = 'admin' and v_appt.clinic_id = public.my_clinic())) then
    raise exception 'Visit not found' using errcode = '42501';
  end if;
  if v_appt.status <> 'scheduled' or v_appt.scheduled_at <= now() then
    raise exception 'This visit can no longer be moved' using errcode = 'P0001';
  end if;
  if p_at = v_appt.scheduled_at then
    return;
  end if;
  if not exists (
    select 1 from public.free_slots(v_appt.doctor_id, (p_at at time zone 'Europe/Kyiv')::date) s
    where s = p_at
  ) then
    raise exception 'This time is no longer available' using errcode = 'P0001';
  end if;

  update public.appointments set scheduled_at = p_at where id = p_appt;
exception
  when unique_violation then
    raise exception 'This time is no longer available' using errcode = 'P0001';
end $$;

revoke all on function public.reschedule_visit(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_visit(uuid, timestamptz) to authenticated;
