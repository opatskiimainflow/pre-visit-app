-- PreVisit migration 008: follow-up questions, medical card, visit summary and rating,
-- doctor time off and email reminders.
-- Run once in Supabase → SQL Editor (after 007), then re-run seed.sql. Safe to run again.

-- ─── Follow-up questions ─────────────────────────────────────────────────
-- A follow-up is shown only when the patient answers "Yes" to its parent (a yes/no question).
-- prefill: which medical-card field fills this answer in advance.
alter table public.questions
  add column if not exists parent_id uuid references public.questions (id) on delete cascade,
  add column if not exists prefill text;

alter table public.questions drop constraint if exists questions_prefill_check;
alter table public.questions add constraint questions_prefill_check
  check (prefill in ('allergies', 'medications', 'conditions'));

-- One level only: the parent is a top-level yes/no question of the same clinic.
create or replace function public.check_question_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id or not exists (
      select 1 from public.questions p
      where p.id = new.parent_id and p.clinic_id = new.clinic_id
        and p.kind = 'yes_no' and p.parent_id is null
    ) then
      raise exception 'A follow-up must belong to a yes/no question that is not a follow-up itself'
        using errcode = 'P0001';
    end if;
    if exists (select 1 from public.questions c where c.parent_id = new.id) then
      raise exception 'This question has follow-ups, so it cannot become a follow-up' using errcode = 'P0001';
    end if;
  end if;
  if new.kind <> 'yes_no' and exists (select 1 from public.questions c where c.parent_id = new.id) then
    raise exception 'A question with follow-ups must stay a yes/no question' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists check_question_parent on public.questions;
create trigger check_question_parent
  before insert or update on public.questions
  for each row execute function public.check_question_parent();

-- ─── Medical card ────────────────────────────────────────────────────────
-- What the patient keeps between visits. Pre-fills the questionnaire; staff of the
-- patient's clinic read it before the visit.
create table if not exists public.medical_cards (
  patient_id  uuid primary key references public.profiles (id) on delete cascade,
  allergies   text not null default '' check (length(allergies) <= 1000),
  medications text not null default '' check (length(medications) <= 1000),
  conditions  text not null default '' check (length(conditions) <= 1000),
  updated_at  timestamptz not null default now()
);
alter table public.medical_cards enable row level security;
revoke all on public.medical_cards from anon, authenticated;
grant select, insert, update on public.medical_cards to authenticated;

drop policy if exists "read medical card" on public.medical_cards;
create policy "read medical card" on public.medical_cards
  for select to authenticated
  using (
    patient_id = auth.uid()
    or (public.my_role() in ('doctor', 'admin') and public.is_clinic_member(patient_id, 'patient'))
  );

drop policy if exists "patient writes own card" on public.medical_cards;
create policy "patient writes own card" on public.medical_cards
  for insert to authenticated
  with check (patient_id = auth.uid() and public.my_role() = 'patient');

drop policy if exists "patient updates own card" on public.medical_cards;
create policy "patient updates own card" on public.medical_cards
  for update to authenticated
  using (patient_id = auth.uid() and public.my_role() = 'patient')
  with check (patient_id = auth.uid() and public.my_role() = 'patient');

-- ─── After the visit: summary from the doctor, rating from the patient ──
create table if not exists public.visit_summaries (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  body           text not null check (length(body) between 1 and 3000),
  updated_at     timestamptz not null default now()
);
alter table public.visit_summaries enable row level security;
revoke all on public.visit_summaries from anon, authenticated;
grant select, insert, update, delete on public.visit_summaries to authenticated;

drop policy if exists "participants read summary" on public.visit_summaries;
create policy "participants read summary" on public.visit_summaries
  for select to authenticated using (public.can_see_appointment(appointment_id));

drop policy if exists "doctor writes summary" on public.visit_summaries;
create policy "doctor writes summary" on public.visit_summaries
  for all to authenticated
  using (public.is_my_visit_as_doctor(appointment_id))
  with check (public.is_my_visit_as_doctor(appointment_id));

create table if not exists public.visit_ratings (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  stars          int  not null check (stars between 1 and 5),
  comment        text not null default '' check (length(comment) <= 1000),
  created_at     timestamptz not null default now()
);
alter table public.visit_ratings enable row level security;
revoke all on public.visit_ratings from anon, authenticated;
grant select, insert on public.visit_ratings to authenticated;

drop policy if exists "participants read rating" on public.visit_ratings;
create policy "participants read rating" on public.visit_ratings
  for select to authenticated using (public.can_see_appointment(appointment_id));

-- Once, by the patient, after the visit is completed. No edits.
drop policy if exists "patient rates completed visit" on public.visit_ratings;
create policy "patient rates completed visit" on public.visit_ratings
  for insert to authenticated
  with check (exists (
    select 1 from public.appointments a
    where a.id = appointment_id and a.patient_id = auth.uid() and a.status = 'completed'
  ));

-- ─── Doctor time off ─────────────────────────────────────────────────────
create table if not exists public.doctor_time_off (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  note       text not null default '' check (length(note) <= 120),
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 366)
);
create index if not exists doctor_time_off_doctor on public.doctor_time_off (doctor_id, start_date);

alter table public.doctor_time_off enable row level security;
revoke all on public.doctor_time_off from anon, authenticated;
grant select, insert, update, delete on public.doctor_time_off to authenticated;

drop policy if exists "clinic reads time off" on public.doctor_time_off;
create policy "clinic reads time off" on public.doctor_time_off
  for select to authenticated using (public.is_clinic_member(doctor_id, 'doctor'));

drop policy if exists "admin manages time off" on public.doctor_time_off;
create policy "admin manages time off" on public.doctor_time_off
  for all to authenticated
  using (public.my_role() = 'admin' and public.is_clinic_member(doctor_id, 'doctor'))
  with check (public.my_role() = 'admin' and public.is_clinic_member(doctor_id, 'doctor'));

-- Days off have no free slots, so patients can neither book nor move a visit onto them.
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
    and not exists (
      select 1 from public.doctor_time_off t
      where t.doctor_id = p_doctor and p_day between t.start_date and t.end_date
    )
    and p_day <= (now() at time zone 'Europe/Kyiv')::date + 30
    and s.slot > now() + interval '1 hour'
    and not exists (
      select 1 from public.appointments a where a.doctor_id = p_doctor and a.scheduled_at = s.slot
    )
  order by 1
$$;
revoke all on function public.free_slots(uuid, date) from public, anon;
grant execute on function public.free_slots(uuid, date) to authenticated;

-- ─── Audit log: new kinds of events ──────────────────────────────────────
alter table public.appointment_events drop constraint if exists appointment_events_action_check;
alter table public.appointment_events add constraint appointment_events_action_check check (action in (
  'booked', 'cancelled', 'rescheduled', 'completed', 'reopened',
  'intake_submitted', 'note_created', 'note_edited',
  'summary_shared', 'rated', 'reminder_sent'));

create or replace function public.audit_after_visit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = new.appointment_id;
  if v_appt.id is null then
    return null;
  end if;
  if tg_table_name = 'visit_ratings' then
    perform public.log_visit_event(v_appt, 'rated', jsonb_build_object('stars', new.stars));
  elsif tg_op = 'INSERT' then
    perform public.log_visit_event(v_appt, 'summary_shared', '{}');
  end if;
  return null;
end $$;
revoke all on function public.audit_after_visit() from public, anon, authenticated;

drop trigger if exists audit_summaries on public.visit_summaries;
create trigger audit_summaries
  after insert on public.visit_summaries
  for each row execute function public.audit_after_visit();

drop trigger if exists audit_ratings on public.visit_ratings;
create trigger audit_ratings
  after insert on public.visit_ratings
  for each row execute function public.audit_after_visit();

-- ─── Email reminders ─────────────────────────────────────────────────────
-- Every evening: visits tomorrow whose questionnaire is still empty get one email with
-- a link to it. Sent straight from the database through Resend (pg_net), so no app
-- server or secret in the app is involved. The Resend API key lives in Supabase Vault:
--   select vault.create_secret('re_…', 'resend_api_key');
-- Without the key the job does nothing.
create extension if not exists pg_net;

alter table public.appointments add column if not exists reminder_sent_at timestamptz;

create or replace function public.send_visit_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_key      text;
  v_from     text;
  v_app      text;
  v_tomorrow date := (now() at time zone 'Europe/Kyiv')::date + 1;
  v_appt     public.appointments;
  v_email    text;
  v_name     text;
  v_doctor   text;
  v_name_h   text;
  v_doctor_h text;
  v_when     text;
  v_link     text;
  v_sent     int := 0;
  esc        constant text[] := array['&', '&amp;', '<', '&lt;', '>', '&gt;', '"', '&quot;'];
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key';
  if v_key is null then
    return 0;
  end if;
  -- Optional overrides; the defaults work with a fresh Resend account.
  select decrypted_secret into v_from from vault.decrypted_secrets where name = 'reminder_from';
  select decrypted_secret into v_app  from vault.decrypted_secrets where name = 'app_url';
  v_from := coalesce(v_from, 'PreVisit <onboarding@resend.dev>');
  v_app  := rtrim(coalesce(v_app, 'https://previsit.opasnuu.workers.dev'), '/');

  for v_appt in
    select a.* from public.appointments a
    join auth.users u on u.id = a.patient_id
    where a.status = 'scheduled'
      and a.reminder_sent_at is null
      and (a.scheduled_at at time zone 'Europe/Kyiv')::date = v_tomorrow
      and not exists (select 1 from public.intakes i where i.appointment_id = a.id)
      -- Demo and no-login people have no real inbox.
      and u.email not like '%@demo.previsit.app'
      and u.email not like '%@no-login.previsit.app'
    order by a.scheduled_at
    limit 50
  loop
    select u.email, p.full_name into v_email, v_name
      from auth.users u join public.profiles p on p.id = u.id where u.id = v_appt.patient_id;
    select full_name into v_doctor from public.profiles where id = v_appt.doctor_id;
    v_when := to_char(v_appt.scheduled_at at time zone 'Europe/Kyiv', 'FMDay DD Mon, HH24:MI');
    v_link := v_app || '/patient/visit/' || v_appt.id;
    v_name     := split_part(v_name, ' ', 1);
    v_name_h   := v_name;
    v_doctor_h := v_doctor;
    for i in 1..4 loop   -- names are typed by people: escape them for the HTML part
      v_name_h   := replace(v_name_h,   esc[i * 2 - 1], esc[i * 2]);
      v_doctor_h := replace(v_doctor_h, esc[i * 2 - 1], esc[i * 2]);
    end loop;

    perform net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'from', v_from,
        'to', jsonb_build_array(v_email),
        'subject', 'Your visit tomorrow — 2 minutes to prepare',
        'text', format(E'Hi %s,\n\nYou have a visit with %s tomorrow, %s.\nPlease answer a few questions so your doctor can prepare: %s\n\nPreVisit (portfolio demo)',
                       v_name, v_doctor, v_when, v_link),
        'html', format(
          '<div style="font-family:Arial,sans-serif;max-width:480px;color:#0f2a2e">'
          '<p>Hi %s,</p><p>You have a visit with <b>%s</b> tomorrow, <b>%s</b>.</p>'
          '<p>Please answer a few questions so your doctor can prepare. It takes about 2 minutes.</p>'
          '<p><a href="%s" style="display:inline-block;background:#0E9F9A;color:#fff;padding:12px 22px;'
          'border-radius:999px;text-decoration:none;font-weight:bold">Fill in the questionnaire</a></p>'
          '<p style="color:#5b7275;font-size:12px">PreVisit is a portfolio demo. You get this email because '
          'you booked a visit in it.</p></div>',
          v_name_h, v_doctor_h, v_when, v_link)
      )
    );

    update public.appointments set reminder_sent_at = now() where id = v_appt.id;
    perform public.log_visit_event(v_appt, 'reminder_sent', '{}');
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end $$;

revoke all on function public.send_visit_reminders() from public, anon, authenticated;

-- 16:00 UTC = 18:00 Kyiv in winter (19:00 in summer).
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule('previsit-reminders')
where exists (select 1 from cron.job where jobname = 'previsit-reminders');
select cron.schedule('previsit-reminders', '0 16 * * *', 'select public.send_visit_reminders()');

-- A moved visit gets a fresh reminder for its new day.
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

  update public.appointments set scheduled_at = p_at, reminder_sent_at = null where id = p_appt;
exception
  when unique_violation then
    raise exception 'This time is no longer available' using errcode = 'P0001';
end $$;

revoke all on function public.reschedule_visit(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_visit(uuid, timestamptz) to authenticated;
