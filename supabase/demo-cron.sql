-- Resets the PreVisit demo every night at 03:00 Kyiv time (01:00 UTC in winter, cron runs in UTC).
-- Run once in Supabase → SQL Editor, after seed.sql.
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule('reset-previsit-demo')
where exists (select 1 from cron.job where jobname = 'reset-previsit-demo');

select cron.schedule('reset-previsit-demo', '0 1 * * *', 'select public.reset_demo()');
