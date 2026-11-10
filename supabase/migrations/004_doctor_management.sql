-- PreVisit migration 004: clinic admins manage doctors and their working hours.
-- Run once in Supabase → SQL Editor (after 003). Safe to run again.

-- ─── Active flag ─────────────────────────────────────────────────────────
-- Doctors are deactivated, never deleted, so their past visits and notes stay intact.
alter table public.profiles add column if not exists active boolean not null default true;

-- ─── Admins edit doctors of their clinic ─────────────────────────────────
-- Column grants: through the API only these profile columns can ever change.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, specialty, active) on public.profiles to authenticated;

drop policy if exists "admin updates clinic doctors" on public.profiles;
create policy "admin updates clinic doctors" on public.profiles
  for update to authenticated
  using (public.my_role() = 'admin' and clinic_id = public.my_clinic() and role = 'doctor')
  with check (public.my_role() = 'admin' and clinic_id = public.my_clinic() and role = 'doctor');

-- ─── Admins manage working hours ─────────────────────────────────────────
grant insert, update, delete on public.doctor_hours to authenticated;

drop policy if exists "admin manages doctor hours" on public.doctor_hours;
create policy "admin manages doctor hours" on public.doctor_hours
  for all to authenticated
  using (public.my_role() = 'admin' and public.is_clinic_member(doctor_id, 'doctor'))
  with check (public.my_role() = 'admin' and public.is_clinic_member(doctor_id, 'doctor'));

-- ─── Adding a doctor ─────────────────────────────────────────────────────
-- Creates a doctor profile in the admin's clinic. The doctor gets an auth record
-- WITHOUT a password (no login yet); inviting them by email is a separate step.
create or replace function public.add_doctor(p_name text, p_specialty text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id     uuid := gen_random_uuid();
  v_clinic uuid := public.my_clinic();
  v_name   text := left(trim(coalesce(p_name, '')), 80);
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only clinic admins can add doctors' using errcode = '42501';
  end if;
  if length(v_name) < 3 then
    raise exception 'Enter the doctor''s full name' using errcode = 'P0001';
  end if;
  if (select count(*) from public.profiles where clinic_id = v_clinic and role = 'doctor') >= 10 then
    raise exception 'A clinic can have at most 10 doctors in this demo' using errcode = 'P0001';
  end if;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'staff-' || v_id || '@no-login.previsit.app', now(), now(),
          '{"provider":"email","providers":["email"]}', '{}');

  insert into public.profiles (id, clinic_id, role, full_name, specialty)
  values (v_id, v_clinic, 'doctor', v_name, nullif(left(trim(coalesce(p_specialty, '')), 80), ''));

  return v_id;
end $$;

revoke all on function public.add_doctor(text, text) from public, anon;
grant execute on function public.add_doctor(text, text) to authenticated;

-- ─── Inactive doctors have no free slots ─────────────────────────────────
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
    and exists (select 1 from public.profiles p where p.id = p_doctor and p.active)
    and p_day <= (now() at time zone 'Europe/Kyiv')::date + 30
    and s.slot > now() + interval '1 hour'
    and not exists (
      select 1 from public.appointments a where a.doctor_id = p_doctor and a.scheduled_at = s.slot
    )
  order by 1
$$;
revoke all on function public.free_slots(uuid, date) from public, anon;
grant execute on function public.free_slots(uuid, date) to authenticated;

-- ─── Admins only book active doctors ─────────────────────────────────────
create or replace function public.is_clinic_member(person uuid, wanted_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = person and p.clinic_id = public.my_clinic() and p.role = wanted_role
  )
$$;

drop policy if exists "admin books appointments" on public.appointments;
create policy "admin books appointments" on public.appointments
  for insert to authenticated
  with check (
    public.my_role() = 'admin'
    and clinic_id = public.my_clinic()
    and public.is_clinic_member(patient_id, 'patient')
    and public.is_clinic_member(doctor_id, 'doctor')
    and exists (select 1 from public.profiles p where p.id = doctor_id and p.active)
  );
