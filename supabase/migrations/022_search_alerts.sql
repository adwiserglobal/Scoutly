-- New-company alerts: a saved search (query + area) checked daily; companies not seen before are emailed.
-- Written only by the server (service key); RLS enabled with no policies on purpose.
create table if not exists public.search_alerts (
  id uuid primary key default gen_random_uuid(),
  user_uid text not null references public.app_users(firebase_uid) on delete cascade,
  query text not null,
  region_name text,
  west double precision not null,
  south double precision not null,
  east double precision not null,
  north double precision not null,
  enabled boolean not null default true,
  seen_ids jsonb not null default '[]'::jsonb,
  baseline_done boolean not null default false,
  last_checked_at timestamptz,
  last_notified_at timestamptz,
  total_found integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists search_alerts_user_idx on public.search_alerts (user_uid);
create index if not exists search_alerts_due_idx on public.search_alerts (enabled, last_checked_at nulls first);

alter table public.search_alerts enable row level security;

notify pgrst, 'reload schema';
