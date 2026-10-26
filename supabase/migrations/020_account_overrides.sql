-- Per-account feature switches managed from Scoutly Internal.
-- A feature listed in disabled_features is blocked server-side for that user, whatever their plan.
create table if not exists public.account_overrides (
  user_uid text primary key references public.app_users(firebase_uid) on delete cascade,
  disabled_features text[] not null default '{}',
  note text,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.account_overrides enable row level security;
-- No policies on purpose: only the service role (server) reads and writes this table.
