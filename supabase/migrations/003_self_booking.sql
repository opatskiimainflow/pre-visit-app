-- PreVisit migration 003: patients book visits themselves from doctors' free slots.
-- Run once in Supabase → SQL Editor (after 002). Safe to run again.

-- ─── Doctors: specialty and weekly working hours ─────────────────────────
alter table public.profiles add column if not exists specialty text;

create table if not exists public.doctor_hours (
  id           uuid primary key default gen_random_uuid(),
  doctor_id    uuid not null references public.profiles (id) on delete cascade,
  weekday      int  not null check (weekday between 1 and 7),   -- ISO: 1 = Monday … 7 = Sunday
  start_time   time not null,                                  -- clinic time (Kyiv)
  end_time     time not null,
  slot_minutes int  not null default 30 check (slot_minutes between 10 and 120),
  check (end_time > start_time)
);
create index if not exists doctor_hours_doctor on public.doctor_hours (doctor_id, weekday);

alter table public.doctor_hours enable row level security;
grant select on public.doctor_hours to authenticated;

drop policy if exists "clinic reads doctor hours" on public.doctor_hours;
create policy "clinic reads doctor hours" on public.doctor_hours
  for select to authenticated using (public.is_clinic_member(doctor_id, 'doctor'));

-- A doctor can never have two visits at the same moment (also stops double booking races).
create unique index if not exists appointments_doctor_slot on public.appointments (doctor_id, scheduled_at);

-- ─── Free slots ──────────────────────────────────────────────────────────
-- Free start times for a doctor on a day (clinic time). Runs as definer so it can see
-- which times are taken without revealing who took them.
create or replace function public.free_slots(p_doctor uuid, p_day date) returns setof timestamptz
language sql stable security definer set search_path = '' as $$
  select s.slot
  from public.doctor_hours h
  cross join lateral generate_series(
    (p_day + h.start_time) at time zone 'Europe/Kyiv',
    ((p_day + h.end_time) at time zone 'Europe/Kyiv') - make_interval(mins => h.slot_minutes),
    make_interval(mins => h.slot_minutes)
  ) as s(slot)
  where h.doctor_id = p_doctor
    and h.weekday = extract(isodow from p_day)
    and public.is_clinic_member(p_doctor, 'doctor')
    and p_day <= (now() at time zone 'Europe/Kyiv')::date + 30
    and s.slot > now() + interval '1 hour'
    and not exists (
      select 1 from public.appointments a where a.doctor_id = p_doctor and a.scheduled_at = s.slot
    )
  order by 1
$$;

-- ─── Booking ─────────────────────────────────────────────────────────────
-- The only way a patient creates a visit: checks role, clinic, schedule and availability.
create or replace function public.book_slot(p_doctor uuid, p_at timestamptz, p_reason text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id  uuid;
  v_day date := (p_at at time zone 'Europe/Kyiv')::date;
begin
  if public.my_role() is distinct from 'patient' then
    raise exception 'Only patients can book a visit' using errcode = '42501';
  end if;
  if (select count(*) from public.appointments
      where patient_id = auth.uid() and status = 'scheduled' and scheduled_at > now()) >= 5 then
    raise exception 'You already have 5 upcoming visits' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.free_slots(p_doctor, v_day) s where s = p_at) then
    raise exception 'This time is no longer available' using errcode = 'P0001';
  end if;

  insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason)
  values (public.my_clinic(), auth.uid(), p_doctor, p_at, nullif(left(trim(coalesce(p_reason, '')), 200), ''))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'This time is no longer available' using errcode = 'P0001';
end $$;

revoke all on function public.free_slots(uuid, date) from public, anon;
revoke all on function public.book_slot(uuid, timestamptz, text) from public, anon;
grant execute on function public.free_slots(uuid, date) to authenticated;
grant execute on function public.book_slot(uuid, timestamptz, text) to authenticated;

-- ─── Patients cancel their own upcoming visits ───────────────────────────
drop policy if exists "patient cancels own visit" on public.appointments;
create policy "patient cancels own visit" on public.appointments
  for delete to authenticated
  using (patient_id = auth.uid() and status = 'scheduled' and scheduled_at > now());
