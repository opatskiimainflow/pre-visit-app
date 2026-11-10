-- PreVisit migration 002: booking, visit workflow and editing.
-- Run once in Supabase → SQL Editor (after schema.sql). Safe to run again.

-- ─── Columns ─────────────────────────────────────────────────────────────
alter table public.appointments
  add column if not exists status       text not null default 'scheduled',
  add column if not exists completed_at timestamptz;

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check check (status in ('scheduled', 'completed'));

alter table public.notes add column if not exists edited_at timestamptz;

-- Doctor's private notes live in their own table so patients can never read them,
-- even though patients can read their own appointment rows.
create table if not exists public.doctor_notes (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  body           text not null default '',
  updated_at     timestamptz not null default now()
);
alter table public.doctor_notes enable row level security;
grant select, insert, update on public.doctor_notes to authenticated;

-- ─── Helpers ─────────────────────────────────────────────────────────────
-- True when the profile belongs to the caller's clinic and has the given role.
create or replace function public.is_clinic_member(person uuid, wanted_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = person and p.clinic_id = public.my_clinic() and p.role = wanted_role
  )
$$;

create or replace function public.is_my_visit_as_doctor(appt uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.appointments a where a.id = appt and a.doctor_id = auth.uid())
$$;

-- ─── Appointments: admins book and cancel ────────────────────────────────
drop policy if exists "admin books appointments" on public.appointments;
create policy "admin books appointments" on public.appointments
  for insert to authenticated
  with check (
    public.my_role() = 'admin'
    and clinic_id = public.my_clinic()
    and public.is_clinic_member(patient_id, 'patient')
    and public.is_clinic_member(doctor_id, 'doctor')
  );

drop policy if exists "admin cancels appointments" on public.appointments;
create policy "admin cancels appointments" on public.appointments
  for delete to authenticated
  using (public.my_role() = 'admin' and clinic_id = public.my_clinic() and status = 'scheduled');

-- ─── Appointments: doctors complete visits ───────────────────────────────
-- Column grants: through the API a doctor can change ONLY the status columns,
-- never the patient, doctor, clinic or time of a visit.
revoke update on public.appointments from authenticated, anon;
grant update (status, completed_at) on public.appointments to authenticated;

drop policy if exists "doctor updates own visit" on public.appointments;
create policy "doctor updates own visit" on public.appointments
  for update to authenticated
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- ─── Doctor's private notes ──────────────────────────────────────────────
drop policy if exists "doctor reads own visit notes" on public.doctor_notes;
create policy "doctor reads own visit notes" on public.doctor_notes
  for select to authenticated using (public.is_my_visit_as_doctor(appointment_id));

drop policy if exists "doctor writes own visit notes" on public.doctor_notes;
create policy "doctor writes own visit notes" on public.doctor_notes
  for insert to authenticated with check (public.is_my_visit_as_doctor(appointment_id));

drop policy if exists "doctor updates own visit notes" on public.doctor_notes;
create policy "doctor updates own visit notes" on public.doctor_notes
  for update to authenticated
  using (public.is_my_visit_as_doctor(appointment_id))
  with check (public.is_my_visit_as_doctor(appointment_id));

-- ─── Notes: doctors correct the AI note ──────────────────────────────────
revoke update on public.notes from authenticated, anon;
grant update (content, edited_at) on public.notes to authenticated;

drop policy if exists "doctor edits note" on public.notes;
create policy "doctor edits note" on public.notes
  for update to authenticated
  using (public.is_my_visit_as_doctor(appointment_id))
  with check (public.is_my_visit_as_doctor(appointment_id));
