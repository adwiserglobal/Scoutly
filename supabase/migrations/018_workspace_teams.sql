-- Agency teams: owner invites members into the owner's workspace.
--  * workspaces.pipeline_mode: the owner decides whether the pipeline is shared or individual.
--  * workspaces.extra_seats: seats bought beyond the 5 included in Agency (billed by Stripe).
--  * workspace_invites: e-mail invitations (only a hash of the token is stored).
--  * a user can be a member of at most one team.
-- AI messages and favorites stay personal; only counts are visible to the owner.
alter table public.workspaces
  add column if not exists pipeline_mode text not null default 'individual',
  add column if not exists extra_seats integer not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_pipeline_mode_check') then
    alter table public.workspaces add constraint workspaces_pipeline_mode_check check (pipeline_mode in ('individual','shared'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspaces_extra_seats_check') then
    alter table public.workspaces add constraint workspaces_extra_seats_check check (extra_seats >= 0 and extra_seats <= 500);
  end if;
end $$;

alter table public.workspace_members
  add column if not exists invited_by text;

create unique index if not exists workspace_members_one_team_per_user
  on public.workspace_members (user_uid) where role = 'member';

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  invited_by text not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by text,
  accepted_at timestamptz
);
create index if not exists workspace_invites_workspace_status on public.workspace_invites (workspace_id, status);
create index if not exists workspace_invites_email on public.workspace_invites (lower(email));
alter table public.workspace_invites enable row level security;

create index if not exists user_leads_workspace_idx on public.user_leads (workspace_id, updated_at desc);
create index if not exists recommendation_events_ws_query_idx on public.recommendation_events (workspace_id, query, created_at desc);
create index if not exists generated_messages_ws_idx on public.generated_messages (workspace_id, created_at desc);

notify pgrst, 'reload schema';
