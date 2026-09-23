-- Internal/backoffice records must never be readable through the public Supabase API.
-- The Scoutly backend uses a service credential and bypasses RLS.

alter table if exists public.internal_access_allowlist enable row level security;
alter table if exists public.internal_security_config enable row level security;
alter table if exists public.internal_gate_sessions enable row level security;
alter table if exists public.internal_access_attempts enable row level security;
alter table if exists public.internal_staff enable row level security;
alter table if exists public.support_tickets enable row level security;
alter table if exists public.support_messages enable row level security;
alter table if exists public.internal_audit_logs enable row level security;

revoke all on table public.internal_access_allowlist from anon, authenticated;
revoke all on table public.internal_security_config from anon, authenticated;
revoke all on table public.internal_gate_sessions from anon, authenticated;
revoke all on table public.internal_access_attempts from anon, authenticated;
revoke all on table public.internal_staff from anon, authenticated;
revoke all on table public.support_tickets from anon, authenticated;
revoke all on table public.support_messages from anon, authenticated;
revoke all on table public.internal_audit_logs from anon, authenticated;
