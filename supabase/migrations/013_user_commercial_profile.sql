-- Per-user commercial profile (used to personalize AI outreach) and report branding.
-- Additive and idempotent: safe to run more than once.
alter table public.user_settings
  add column if not exists outreach_profile jsonb not null default '{}'::jsonb,
  add column if not exists brand_profile jsonb not null default '{}'::jsonb,
  add column if not exists brand_logo text;

comment on column public.user_settings.outreach_profile is
  'What the user sells/offers, tone and call to action. Injected into AI-generated outreach messages.';
comment on column public.user_settings.brand_profile is
  'White-label report settings: display name, colors, tagline, contact lines and logo dimensions.';
comment on column public.user_settings.brand_logo is
  'Logo as a PNG/JPEG data URL (client-resized, size-capped). Kept out of the bootstrap payload.';
