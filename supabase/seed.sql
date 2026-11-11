-- PreVisit demo data. All people and health details here are FICTIONAL.
--
-- Defines public.reset_demo(), which wipes and recreates the demo clinic with
-- visits dated "today" and "tomorrow", then runs it once.
-- supabase/demo-cron.sql schedules it to run every night, so the live demo always looks fresh.
--
-- Run AFTER schema.sql and all migrations (002–007).
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
  v_today   date := (now() at time zone 'Europe/Kyiv')::date;
  v_pool    uuid[];
  v_reasons text[] := array['Check-up', 'Headaches', 'Back pain', 'Follow-up', 'Persistent cough',
                            'Blood pressure', 'Chest discomfort', 'Fatigue', 'Skin rash', 'Lab results'];
  v_d       date;
  v_n       int;
  v_idx     int;
  v_at      timestamptz;
  v_pat     uuid;
begin
  -- The reset writes a lot of rows; it adds its own believable history at the end
  -- instead of logging every insert as "System" (see migrations/007).
  perform set_config('previsit.skip_audit', 'on', true);

  if v_patient is null or v_doctor is null or v_admin is null then
    raise exception 'Create the three demo users in Authentication first (see the comment at the top).';
  end if;

  -- Reset previous demo data.
  delete from public.clinics where name = 'Sunrise Family Clinic';
  delete from auth.users where email like 'fictional-%@demo.previsit.app';
  -- Visitors who signed up through the app (see migrations/006): their accounts last one day.
  delete from auth.users where raw_user_meta_data ->> 'self_signup' = 'true';
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
  update public.profiles set date_of_birth = date '1990-03-14', sex = 'female' where id = v_patient;

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
  update public.profiles set date_of_birth = date '1982-07-02', sex = 'male'   where id = v_extra[1];
  update public.profiles set date_of_birth = date '1996-11-23', sex = 'female' where id = v_extra[2];
  update public.profiles set date_of_birth = date '1959-01-30', sex = 'male'   where id = v_extra[3];

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

  -- ── More fictional patients and 8 weeks of history (for the analytics dashboard) ──
  for i in 4..8 loop
    v_extra := v_extra || gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at,
                            raw_app_meta_data, raw_user_meta_data)
    values (v_extra[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'fictional-' || i || '-' || substr(v_extra[i]::text, 1, 8) || '@demo.previsit.app',
            now(), now(), '{"provider":"email","providers":["email"]}', '{}');
  end loop;
  insert into public.profiles (id, clinic_id, role, full_name, date_of_birth, sex) values
    (v_extra[4], v_clinic, 'patient', 'Anna Moroz',          date '1988-05-19', 'female'),
    (v_extra[5], v_clinic, 'patient', 'Dmytro Bondarenko',   date '1975-09-03', 'male'),
    (v_extra[6], v_clinic, 'patient', 'Sofia Kravets',       date '2001-02-11', 'female'),
    (v_extra[7], v_clinic, 'patient', 'Oleh Tkachenko',      date '1966-12-27', 'male'),
    (v_extra[8], v_clinic, 'patient', 'Yulia Savchenko',     date '1993-08-08', 'female');
  v_pool := v_extra;

  -- Past visits: deterministic patterns, so the charts look the same after every reset.
  for v_d in select generate_series(v_today - 56, v_today - 1, interval '1 day')::date loop
    v_idx := v_d - v_today + 57;
    if extract(isodow from v_d) between 1 and 5 then          -- Dr. Melnyk, Mon–Fri
      v_n := 1 + (v_idx * 7 + v_idx / 7) % 3 + v_idx / 19;
      for k in 0..v_n - 1 loop
        v_at  := (v_d + time '09:00' + make_interval(mins => k * 90)) at time zone 'Europe/Kyiv';
        v_pat := v_pool[1 + (v_idx * 5 + k) % array_length(v_pool, 1)];
        insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason, status, completed_at)
        values (v_clinic, v_pat, v_doctor, v_at, v_reasons[1 + (v_idx + k * 3) % 10],
                'completed', v_at + interval '30 minutes')
        returning id into v_appt;
        if (v_idx + k) % 6 <> 0 then
          insert into public.intakes (appointment_id, answers, submitted_at) values (v_appt,
            jsonb_build_array(jsonb_build_object('question', 'What is the main reason for your visit?',
                                                 'answer', v_reasons[1 + (v_idx + k * 3) % 10])),
            v_at - interval '20 hours');
        end if;
      end loop;
    end if;
    if extract(isodow from v_d) in (2, 4) then                -- Dr. Petrenko, Tue/Thu
      v_n := 1 + (v_idx * 3) % 3;
      for k in 0..v_n - 1 loop
        v_at  := (v_d + time '10:00' + make_interval(mins => k * 60)) at time zone 'Europe/Kyiv';
        v_pat := v_pool[1 + (v_idx * 3 + k + 2) % array_length(v_pool, 1)];
        insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason, status, completed_at)
        values (v_clinic, v_pat, v_doc2, v_at, v_reasons[1 + (v_idx * 2 + k) % 10],
                'completed', v_at + interval '30 minutes')
        returning id into v_appt;
        if (v_idx + k) % 4 <> 0 then
          insert into public.intakes (appointment_id, answers, submitted_at) values (v_appt,
            jsonb_build_array(jsonb_build_object('question', 'What is the main reason for your visit?',
                                                 'answer', v_reasons[1 + (v_idx * 2 + k) % 10])),
            v_at - interval '1 day');
        end if;
      end loop;
    end if;
  end loop;

  -- Upcoming week: some booked slots, so the calendar and the load chart are not empty.
  for v_d in select generate_series(v_today + 1, v_today + 7, interval '1 day')::date loop
    v_idx := v_d - v_today;
    if extract(isodow from v_d) between 1 and 5 then
      for k in 0..(v_idx % 3) loop
        v_at := (v_d + time '11:30' + make_interval(mins => k * 90)) at time zone 'Europe/Kyiv';
        insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason)
        values (v_clinic, v_pool[1 + (v_idx * 2 + k) % array_length(v_pool, 1)], v_doctor, v_at,
                v_reasons[1 + (v_idx + k) % 10])
        returning id into v_appt;
        if (v_idx + k) % 2 = 0 then
          insert into public.intakes (appointment_id, answers) values (v_appt,
            jsonb_build_array(jsonb_build_object('question', 'What is the main reason for your visit?',
                                                 'answer', v_reasons[1 + (v_idx + k) % 10])));
        end if;
      end loop;
    end if;
    if extract(isodow from v_d) in (2, 4, 6) then
      insert into public.appointments (clinic_id, patient_id, doctor_id, scheduled_at, reason)
      values (v_clinic, v_pool[1 + (v_idx + 4) % array_length(v_pool, 1)], v_doc2,
              (v_d + time '10:30') at time zone 'Europe/Kyiv', v_reasons[1 + (v_idx * 3) % 10]);
    end if;
  end loop;

  -- A believable activity log for everything above (who booked, filled in, completed).
  insert into public.appointment_events (clinic_id, appointment_id, patient_id, doctor_id,
      actor_id, actor_name, actor_role, action, patient_name, doctor_name, scheduled_at, details, created_at)
  select a.clinic_id, a.id, a.patient_id, a.doctor_id,
         case when x.by_admin then v_admin else a.patient_id end,
         case when x.by_admin then 'Iryna Bondar' else p.full_name end,
         case when x.by_admin then 'admin' else 'patient' end,
         'booked', p.full_name, d.full_name, a.scheduled_at,
         jsonb_build_object('reason', a.reason),
         least(now() - interval '5 minutes', a.scheduled_at - make_interval(days => 2 + x.h % 5, hours => x.h % 9))
  from public.appointments a
  join public.profiles p on p.id = a.patient_id
  join public.profiles d on d.id = a.doctor_id
  cross join lateral (select abs(hashtext(a.id::text)) as h, abs(hashtext(a.id::text)) % 3 = 0 as by_admin) x
  where a.clinic_id = v_clinic;

  insert into public.appointment_events (clinic_id, appointment_id, patient_id, doctor_id,
      actor_id, actor_name, actor_role, action, patient_name, doctor_name, scheduled_at, created_at)
  select a.clinic_id, a.id, a.patient_id, a.doctor_id, a.patient_id, p.full_name, 'patient',
         'intake_submitted', p.full_name, d.full_name, a.scheduled_at,
         least(now() - interval '2 minutes', i.submitted_at)
  from public.intakes i
  join public.appointments a on a.id = i.appointment_id
  join public.profiles p on p.id = a.patient_id
  join public.profiles d on d.id = a.doctor_id
  where a.clinic_id = v_clinic;

  insert into public.appointment_events (clinic_id, appointment_id, patient_id, doctor_id,
      actor_id, actor_name, actor_role, action, patient_name, doctor_name, scheduled_at, created_at)
  select a.clinic_id, a.id, a.patient_id, a.doctor_id, a.doctor_id, d.full_name, 'doctor',
         'completed', p.full_name, d.full_name, a.scheduled_at, a.completed_at
  from public.appointments a
  join public.profiles p on p.id = a.patient_id
  join public.profiles d on d.id = a.doctor_id
  where a.clinic_id = v_clinic and a.status = 'completed';

  perform set_config('previsit.skip_audit', 'off', true);
end $$;

-- Only the database itself (cron / SQL editor) may run this. It is never callable from the app.
revoke all on function public.reset_demo() from public, anon, authenticated;

select public.reset_demo();
