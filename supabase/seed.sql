-- PreVisit demo data. All people and health details here are FICTIONAL.
--
-- Defines public.reset_demo(), which wipes and recreates the demo clinic with
-- visits dated "today" and "tomorrow", then runs it once.
-- supabase/demo-cron.sql schedules it to run every night, so the live demo always looks fresh.
--
-- Run AFTER schema.sql and migrations/002, 003 and 004.
--
-- Before the first run: create three users in Supabase → Authentication → Users → Add user
-- (tick "Auto Confirm User"), all with the same password = your DEMO_PASSWORD:
--   patient@demo.previsit.app
--   doctor@demo.previsit.app
--   admin@demo.previsit.app

create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_clinic  uuid;
  v_patient uuid := (select id from auth.users where email = 'patient@demo.previsit.app');
  v_doctor  uuid := (select id from auth.users where email = 'doctor@demo.previsit.app');
  v_admin   uuid := (select id from auth.users where email = 'admin@demo.previsit.app');
  v_extra   uuid[] := array[]::uuid[];
  v_appt    uuid;
  v_doc2    uuid := gen_random_uuid();
  today     timestamptz := date_trunc('day', now() at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv';
begin
  if v_patient is null or v_doctor is null or v_admin is null then
    raise exception 'Create the three demo users in Authentication first (see the comment at the top).';
  end if;

  -- Reset previous demo data.
  delete from public.clinics where name = 'Sunrise Family Clinic';
  delete from auth.users where email like 'fictional-%@demo.previsit.app';
  -- Doctors added by visitors through the admin page (no login) whose clinic is gone.
  delete from auth.users u
  where u.email like 'staff-%@no-login.previsit.app'
    and not exists (select 1 from public.profiles p where p.id = u.id);

  insert into public.clinics (name) values ('Sunrise Family Clinic') returning id into v_clinic;

  insert into public.profiles (id, clinic_id, role, full_name) values
    (v_patient, v_clinic, 'patient', 'Olena Kovalenko'),
    (v_doctor,  v_clinic, 'doctor',  'Dr. Andriy Melnyk'),
    (v_admin,   v_clinic, 'admin',   'Iryna Bondar');
  update public.profiles set specialty = 'Family medicine' where id = v_doctor;

  -- A second (fictional, no login) doctor so patients have a choice.
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data)
  values (v_doc2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'fictional-doctor-' || substr(v_doc2::text, 1, 8) || '@demo.previsit.app',
          now(), now(), '{"provider":"email","providers":["email"]}', '{}');
  insert into public.profiles (id, clinic_id, role, full_name, specialty)
  values (v_doc2, v_clinic, 'doctor', 'Dr. Oksana Petrenko', 'Cardiology');

  -- Weekly working hours (clinic time). Free slots = these hours minus booked visits.
  insert into public.doctor_hours (doctor_id, weekday, start_time, end_time, slot_minutes)
  select v_doctor, d, time '09:00', time '17:00', 30 from generate_series(1, 5) d
  union all select v_doc2, 2, time '10:00', time '16:00', 30
  union all select v_doc2, 4, time '10:00', time '16:00', 30
  union all select v_doc2, 6, time '10:00', time '13:00', 30;

  insert into public.questions (clinic_id, position, text, kind, required) values
    (v_clinic, 1, 'What is the main reason for your visit?', 'long', true),
    (v_clinic, 2, 'When did it start, and is it getting better or worse?', 'short', true),
    (v_clinic, 3, 'Which medications do you take right now (including supplements)?', 'long', true),
    (v_clinic, 4, 'Do you have any allergies to medicines or food?', 'short', true),
    (v_clinic, 5, 'Do you have any chronic conditions (e.g. diabetes, asthma, hypertension)?', 'short', false),
    (v_clinic, 6, 'Have you had chest pain, shortness of breath or fainting recently?', 'yes_no', true),
    (v_clinic, 7, 'Anything else you want your doctor to know?', 'long', false);

  -- The demo patient's upcoming visit (questionnaire not filled yet).
  insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason)
  values (v_clinic, v_patient, v_doctor, today + interval '1 day 10 hours', 'Persistent cough');

  -- Other fictional patients on the doctor's schedule today.
  -- They have no login, so we create them as auth users without passwords.
  for i in 1..3 loop
    v_extra := v_extra || gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at,
                            raw_app_meta_data, raw_user_meta_data)
    values (v_extra[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'fictional-' || i || '-' || substr(v_extra[i]::text, 1, 8) || '@demo.previsit.app',
            now(), now(), '{"provider":"email","providers":["email"]}', '{}');
  end loop;

  insert into public.profiles (id, clinic_id, role, full_name) values
    (v_extra[1], v_clinic, 'patient', 'Taras Hnatyuk'),
    (v_extra[2], v_clinic, 'patient', 'Maria Shevchuk'),
    (v_extra[3], v_clinic, 'patient', 'Petro Lysenko');

  -- 09:00 — answers in and note ready
  insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason)
  values (v_clinic, v_extra[1], v_doctor, today + interval '9 hours', 'Headaches')
  returning id into v_appt;
  insert into public.intakes (appointment_id, answers) values (v_appt, '[
    {"question":"What is the main reason for your visit?","answer":"Headaches almost every afternoon for the last 3 weeks."},
    {"question":"When did it start, and is it getting better or worse?","answer":"About 3 weeks ago, a bit worse now."},
    {"question":"Which medications do you take right now (including supplements)?","answer":"Ibuprofen 400 mg most days, lisinopril 10 mg."},
    {"question":"Do you have any allergies to medicines or food?","answer":"Penicillin (rash)."},
    {"question":"Do you have any chronic conditions (e.g. diabetes, asthma, hypertension)?","answer":"High blood pressure."},
    {"question":"Have you had chest pain, shortness of breath or fainting recently?","answer":"No"},
    {"question":"Anything else you want your doctor to know?","answer":"Working long hours at a screen."}
  ]');
  insert into public.notes (appointment_id, model, content) values (v_appt, 'demo-seed', '{
    "chief_complaint":"Near-daily afternoon headaches for ~3 weeks, slowly worsening.",
    "history":"Known hypertension on lisinopril. Long hours of screen work.",
    "medications":["Ibuprofen 400 mg, most days","Lisinopril 10 mg"],
    "allergies":["Penicillin — rash"],
    "red_flags":["Frequent NSAID use (possible medication-overuse headache)","Hypertension — check blood pressure at visit"],
    "questions_for_doctor":["Duration of each headache episode?","Any visual changes or nausea?"]
  }');

  -- 3 weeks ago — Taras's earlier, completed visit (shows up in "Previous visits").
  insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason, status, completed_at)
  values (v_clinic, v_extra[1], v_doctor, today - interval '21 days' + interval '10 hours', 'Headaches',
          'completed', today - interval '21 days' + interval '10 hours 30 minutes')
  returning id into v_appt;
  insert into public.notes (appointment_id, model, content) values (v_appt, 'demo-seed', '{
    "chief_complaint":"Afternoon headaches for 1 week after a busy period at work.",
    "history":"Hypertension on lisinopril. No visual symptoms.",
    "medications":["Lisinopril 10 mg"],
    "allergies":["Penicillin - rash"],
    "red_flags":[],
    "questions_for_doctor":["Screen time per day?"]
  }');

  -- 11:30 — answers in, note not generated yet
  insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason)
  values (v_clinic, v_extra[2], v_doctor, today + interval '11 hours 30 minutes', 'Follow-up')
  returning id into v_appt;
  insert into public.intakes (appointment_id, answers) values (v_appt, '[
    {"question":"What is the main reason for your visit?","answer":"Follow-up for my thyroid test results."},
    {"question":"Which medications do you take right now (including supplements)?","answer":"Levothyroxine 50 mcg."},
    {"question":"Do you have any allergies to medicines or food?","answer":"None."},
    {"question":"Have you had chest pain, shortness of breath or fainting recently?","answer":"No"}
  ]');

  -- 15:00 — waiting for the patient
  insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason)
  values (v_clinic, v_extra[3], v_doctor, today + interval '15 hours', 'Back pain');
end $$;

-- Only the database itself (cron / SQL editor) may run this. It is never callable from the app.
revoke all on function public.reset_demo() from public, anon, authenticated;

select public.reset_demo();
