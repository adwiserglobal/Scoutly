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
    select net.http_get(
      url := 'https://www.scoutly.pro/api/agent/worker',
      timeout_milliseconds := 15000
    );
  $$
);
