alter table public.user_settings
  add column if not exists onboarding_version integer not null default 0,
  add column if not exists onboarding_role text,
  add column if not exists onboarding_team_size text,
  add column if not exists onboarding_goal text,
  add column if not exists onboarding_goal_other text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists tutorial_completed boolean not null default false,
  add column if not exists tutorial_completed_at timestamptz;

comment on column public.user_settings.onboarding_version is
  'Versioned onboarding rollout. Users below the current app version see onboarding on next authenticated session.';
