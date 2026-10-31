-- Email notification preferences. Both default to on, so nothing changes for existing users.
alter table public.user_settings
  add column if not exists notify_business_alerts boolean not null default true,
  add column if not exists notify_product_emails boolean not null default true;

comment on column public.user_settings.notify_business_alerts is
  'Daily email with new companies found by the user''s saved alerts (the bell).';
comment on column public.user_settings.notify_product_emails is
  'Tips and reminders sent by the lifecycle email automation (Resend user.activity events).';

notify pgrst, 'reload schema';
