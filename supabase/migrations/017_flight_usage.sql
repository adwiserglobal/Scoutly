-- Flight mode: daily flight time per user (the Free plan is limited to 5 minutes per UTC day).
-- Written only by the server (service key); RLS enabled with no policies on purpose.
create table if not exists public.flight_usage (
  user_uid text not null references public.app_users(firebase_uid) on delete cascade,
  day date not null,
  seconds integer not null default 0,
  last_tick timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_uid, day)
);

alter table public.flight_usage enable row level security;

notify pgrst, 'reload schema';
