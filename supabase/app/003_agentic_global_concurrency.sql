-- Safety valve for the Agentic queue. Public worker triggers can only advance
-- legitimate runs and can never fan out more than six expensive jobs at once.
create or replace function public.claim_scoutly_agent_run(
  p_worker_id text,
  p_lock_seconds integer default 45
)
returns setof public.agent_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_locks integer;
begin
  select count(*)::integer
    into v_active_locks
  from public.agent_runs r
  where r.status in ('planning','searching','qualifying','saving')
    and r.locked_until is not null
    and r.locked_until > now();

  if v_active_locks >= 6 then
    return;
  end if;

  return query
  with candidate as (
    select r.id
    from public.agent_runs r
    where r.status in ('queued','planning','searching','qualifying','saving')
      and r.next_attempt_at <= now()
      and (r.locked_until is null or r.locked_until < now())
    order by r.priority desc, r.created_at asc
    for update skip locked
    limit 1
  )
  update public.agent_runs r
  set
    status = case when r.status = 'queued' then 'planning' else r.status end,
    stage = case when r.status = 'queued' then 'planning' else r.stage end,
    started_at = coalesce(r.started_at, now()),
    worker_id = p_worker_id,
    lock_token = gen_random_uuid(),
    locked_until = now() + make_interval(secs => greatest(15, least(coalesce(p_lock_seconds, 45), 180))),
    updated_at = now()
  from candidate c
  where r.id = c.id
  returning r.*;
end;
$$;

revoke all on function public.claim_scoutly_agent_run(text, integer) from public;
grant execute on function public.claim_scoutly_agent_run(text, integer) to service_role;
