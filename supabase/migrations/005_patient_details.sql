-- PreVisit migration 005: patient date of birth and sex.
-- Run once in Supabase → SQL Editor (after 004), then re-run seed.sql. Safe to run again.

alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists sex text;

alter table public.profiles drop constraint if exists profiles_sex_check;
alter table public.profiles add constraint profiles_sex_check check (sex in ('female', 'male'));

alter table public.profiles drop constraint if exists profiles_dob_check;
alter table public.profiles add constraint profiles_dob_check
  check (date_of_birth between date '1900-01-01' and current_date);

-- ─── Patients edit their own details ─────────────────────────────────────
-- Through a function, not a column grant: the update grant on profiles is shared by
-- all roles, and a patient must never be able to touch role, clinic or "active".
create or replace function public.update_my_details(p_dob date, p_sex text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'patient' then
    raise exception 'Only patients can edit these details' using errcode = '42501';
  end if;
  if p_dob is not null and (p_dob < date '1900-01-01' or p_dob > current_date) then
    raise exception 'Enter a valid date of birth' using errcode = 'P0001';
  end if;
  if p_sex is not null and p_sex not in ('female', 'male') then
    raise exception 'Unknown value for sex' using errcode = 'P0001';
  end if;

  update public.profiles set date_of_birth = p_dob, sex = p_sex where id = auth.uid();
end $$;

revoke all on function public.update_my_details(date, text) from public, anon;
grant execute on function public.update_my_details(date, text) to authenticated;
