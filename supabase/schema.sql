-- PreVisit database schema
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Every table has Row Level Security on: each clinic only ever sees its own data.

-- ─── Tables ──────────────────────────────────────────────────────────────

create table public.clinics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  clinic_id  uuid not null references public.clinics (id) on delete cascade,
  role       text not null check (role in ('patient', 'doctor', 'admin')),
  full_name  text not null,
  created_at timestamptz not null default now()
);

create table public.questions (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics (id) on delete cascade,
  position   int  not null,
  text       text not null,
  kind       text not null default 'short' check (kind in ('short', 'long', 'yes_no')),
  required   boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics (id) on delete cascade,
  patient_id   uuid not null references public.profiles (id) on delete cascade,
  doctor_id    uuid not null references public.profiles (id) on delete cascade,
  scheduled_at timestamptz not null,
  reason       text,
  created_at   timestamptz not null default now()
);

-- One questionnaire per appointment.
create table public.intakes (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  answers        jsonb not null,   -- [{ "question": "...", "answer": "..." }]
  submitted_at   timestamptz not null default now()
);

-- One AI-prepared note per appointment.
create table public.notes (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  content        jsonb not null,   -- structured note: complaint, history, meds, allergies, red flags
  model          text,
  created_at     timestamptz not null default now()
);

create index on public.profiles (clinic_id);
create index on public.questions (clinic_id, position);
create index on public.appointments (doctor_id, scheduled_at);
create index on public.appointments (patient_id, scheduled_at);

-- ─── Helpers for policies ───────────────────────────────────────────────
-- security definer so policies can read profiles without recursing into RLS.

create function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.my_clinic() returns uuid
language sql stable security definer set search_path = '' as $$
  select clinic_id from public.profiles where id = auth.uid()
$$;

-- True when the signed-in user is the patient or doctor of the appointment,
-- or an admin of its clinic.
create function public.can_see_appointment(appt uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.appointments a
    where a.id = appt
      and (
        a.patient_id = auth.uid()
        or a.doctor_id = auth.uid()
        or (a.clinic_id = public.my_clinic() and public.my_role() = 'admin')
      )
  )
$$;

-- ─── Row Level Security ─────────────────────────────────────────────────

alter table public.clinics      enable row level security;
alter table public.profiles     enable row level security;
alter table public.questions    enable row level security;
alter table public.appointments enable row level security;
alter table public.intakes      enable row level security;
alter table public.notes        enable row level security;

-- Clinics: members see their own clinic.
create policy "members read own clinic" on public.clinics
  for select to authenticated using (id = public.my_clinic());

-- Profiles: everyone sees themselves; doctors and admins see people in their clinic.
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "staff read clinic profiles" on public.profiles
  for select to authenticated
  using (clinic_id = public.my_clinic() and public.my_role() in ('doctor', 'admin'));
-- Patients may see the names of their clinic's doctors (not other patients).
create policy "clinic members read doctors" on public.profiles
  for select to authenticated
  using (clinic_id = public.my_clinic() and role = 'doctor');

-- Questions: whole clinic reads them; only admins change them.
create policy "clinic reads questions" on public.questions
  for select to authenticated using (clinic_id = public.my_clinic());
create policy "admin inserts questions" on public.questions
  for insert to authenticated
  with check (clinic_id = public.my_clinic() and public.my_role() = 'admin');
create policy "admin updates questions" on public.questions
  for update to authenticated
  using (clinic_id = public.my_clinic() and public.my_role() = 'admin')
  with check (clinic_id = public.my_clinic() and public.my_role() = 'admin');
create policy "admin deletes questions" on public.questions
  for delete to authenticated
  using (clinic_id = public.my_clinic() and public.my_role() = 'admin');

-- Appointments: patient and doctor see their own; admin sees the clinic's.
create policy "participants read appointments" on public.appointments
  for select to authenticated using (public.can_see_appointment(id));

-- Intakes: the patient submits their own; participants read.
create policy "participants read intakes" on public.intakes
  for select to authenticated using (public.can_see_appointment(appointment_id));
create policy "patient submits own intake" on public.intakes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.patient_id = auth.uid()
    )
  );

-- Notes: only doctors and admins read them (patients never see the AI note).
create policy "staff read notes" on public.notes
  for select to authenticated
  using (public.my_role() in ('doctor', 'admin') and public.can_see_appointment(appointment_id));
-- The doctor can (re)generate a note for their own appointment.
create policy "doctor inserts note for own appointment" on public.notes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.doctor_id = auth.uid()
    )
  );
-- The note is written by the server right after the patient submits, using
-- the patient's session, so the patient may insert (but not read) it.
create policy "patient inserts note for own appointment" on public.notes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.patient_id = auth.uid()
    )
  );
