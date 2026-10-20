-- "Site em 1 clique": demo websites generated for businesses, served at /demo/<slug>.
-- Public pages are rendered by the server from this row; nothing here is readable with the
-- anon key (RLS enabled on purpose, no policies).
create table if not exists public.demo_sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  user_uid text not null references public.app_users(firebase_uid) on delete cascade,
  business_id text not null,
  business_name text not null default '',
  style text not null default 'clean',
  data jsonb not null default '{}'::jsonb,
  views integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_uid, business_id)
);

create index if not exists idx_demo_sites_user_created
  on public.demo_sites (user_uid, created_at desc);

alter table public.demo_sites enable row level security;

notify pgrst, 'reload schema';
