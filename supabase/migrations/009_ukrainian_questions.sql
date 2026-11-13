-- PreVisit migration 009: Ukrainian text for questionnaire questions.
-- Run once in Supabase → SQL Editor (after 008), then re-run seed.sql. Safe to run again.
--
-- The app has a UA/EN switch. Patients who use it in Ukrainian see text_uk when it is set,
-- otherwise the English text. Answers are saved with the question exactly as it was shown.
alter table public.questions add column if not exists text_uk text;

alter table public.questions drop constraint if exists questions_text_uk_check;
alter table public.questions add constraint questions_text_uk_check
  check (text_uk is null or char_length(text_uk) <= 300);

-- Translate the questions that clinics already have from the demo seed.
update public.questions q set text_uk = t.uk
from (values
  ('What is the main reason for your visit?', 'Яка основна причина вашого візиту?'),
  ('When did it start, and is it getting better or worse?', 'Коли це почалося і чи стає краще або гірше?'),
  ('Which medications do you take right now (including supplements)?', 'Які ліки ви зараз приймаєте (включно з добавками)?'),
  ('Do you have any allergies to medicines or food?', 'Чи є у вас алергія на ліки або їжу?'),
  ('Do you have any chronic conditions (e.g. diabetes, asthma, hypertension)?', 'Чи є у вас хронічні хвороби (напр. діабет, астма, гіпертонія)?'),
  ('Have you had chest pain, shortness of breath or fainting recently?', 'Чи був у вас останнім часом біль у грудях, задишка або непритомність?'),
  ('What exactly happened, when, and how long did it last?', 'Що саме сталося, коли і скільки це тривало?'),
  ('Do you smoke or vape?', 'Чи курите ви або вейпите?'),
  ('How much per day, and for how many years?', 'Скільки на день і скільки років?'),
  ('Anything else you want your doctor to know?', 'Що ще ви хотіли б повідомити лікарю?')
) as t(en, uk)
where q.text = t.en and q.text_uk is null;
