alter table public.subscriptions
  add column if not exists last_provider_event_at timestamptz,
  add column if not exists last_provider_event_id text;

alter table public.stripe_events
  add column if not exists event_created_at timestamptz;

create index if not exists subscriptions_provider_subscription_id_idx
  on public.subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

create index if not exists subscriptions_provider_customer_id_idx
  on public.subscriptions (provider_customer_id)
  where provider_customer_id is not null;

create index if not exists stripe_events_subscription_created_idx
  on public.stripe_events (stripe_subscription_id, event_created_at desc)
  where stripe_subscription_id is not null;
