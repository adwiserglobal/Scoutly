-- Runs the Agentic queue even when the user closes the browser.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname = 'scoutly-agent-worker';

select cron.schedule(
  'scoutly-agent-worker',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://scoutly.pro/api/agent/worker',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"source":"supabase_cron"}'::jsonb,
      timeout_milliseconds := 15000
    );
  $$
);
