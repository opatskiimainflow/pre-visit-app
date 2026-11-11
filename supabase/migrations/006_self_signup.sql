-- PreVisit migration 006: visitors can sign up as patients of the demo clinic.
-- Run once in Supabase → SQL Editor (after 005), then re-run seed.sql. Safe to run again.
--
-- Supabase → Authentication → Sign In / Providers: "Allow new users to sign up" ON,
-- "Confirm email" OFF (the free mailer only reaches project members).

-- A new auth user gets a patient profile only when the app marks it as a self sign-up.
-- The role is always 'patient' and the clinic is always the demo clinic: whatever the
-- client sends in user metadata, it cannot pick a role or a clinic.
create or replace function public.handle_self_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_clinic uuid;
  v_name   text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
begin
  if coalesce(new.raw_user_meta_data ->> 'self_signup', '') <> 'true' then
    return new; -- demo users, fictional patients, staff: profiles are created elsewhere
  end if;

  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Enter your full name (2–80 characters)' using errcode = 'P0001';
  end if;

  select id into v_clinic from public.clinics where name = 'Sunrise Family Clinic' limit 1;
  if v_clinic is null then
    raise exception 'The demo clinic is not available right now' using errcode = 'P0001';
  end if;

  -- Keep the shared demo tidy: at most 100 self-registered patients between nightly resets.
  if (select count(*) from auth.users u where u.raw_user_meta_data ->> 'self_signup' = 'true') > 100 then
    raise exception 'The demo is full today, please use a demo role' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, clinic_id, role, full_name)
  values (new.id, v_clinic, 'patient', v_name);
  return new;
end $$;

revoke all on function public.handle_self_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_self_signup on auth.users;
create trigger on_auth_user_self_signup
  after insert on auth.users
  for each row execute function public.handle_self_signup();
