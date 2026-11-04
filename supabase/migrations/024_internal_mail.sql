-- Internal mail: mailboxes on scoutly.pro, received through Resend inbound webhooks and sent through the Resend API.
-- Server-only (service key); RLS enabled with no policies on purpose.
create table if not exists public.internal_mailboxes (
  address text primary key check (address = lower(address)),
  display_name text not null,
  -- Staff e-mails allowed to open this mailbox. Admins can open every mailbox.
  member_emails text[] not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.internal_mailboxes (address, display_name) values
  ('eduardo@scoutly.pro', 'Eduardo | Scoutly'),
  ('aglemon@scoutly.pro', 'Aglemon | Scoutly')
on conflict (address) do nothing;

create table if not exists public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  mailbox text not null references public.internal_mailboxes(address) on delete cascade,
  counterpart text not null,
  counterpart_name text,
  subject text not null default '',
  norm_subject text not null default '',
  folder text not null default 'inbox' check (folder in ('inbox', 'archive', 'trash')),
  has_outbound boolean not null default false,
  unread_count integer not null default 0,
  message_count integer not null default 0,
  last_snippet text not null default '',
  last_direction text not null default 'in' check (last_direction in ('in', 'out')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists mail_threads_list_idx on public.mail_threads (mailbox, folder, last_message_at desc);
create index if not exists mail_threads_match_idx on public.mail_threads (mailbox, counterpart, norm_subject, last_message_at desc);

create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  mailbox text not null references public.internal_mailboxes(address) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  message_id text,
  in_reply_to text,
  refs text,
  from_addr text not null,
  from_name text,
  to_addrs jsonb not null default '[]'::jsonb,
  cc_addrs jsonb not null default '[]'::jsonb,
  subject text not null default '',
  text_body text not null default '',
  html_body text,
  attachments jsonb not null default '[]'::jsonb,
  resend_email_id text,
  sent_by text,
  created_at timestamptz not null default now()
);

create index if not exists mail_messages_thread_idx on public.mail_messages (thread_id, created_at);
create index if not exists mail_messages_msgid_idx on public.mail_messages (mailbox, message_id);
-- The same inbound e-mail is never stored twice for a mailbox (webhook retries).
create unique index if not exists mail_messages_inbound_unique on public.mail_messages (resend_email_id, mailbox) where direction = 'in';

alter table public.internal_mailboxes enable row level security;
alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;

notify pgrst, 'reload schema';
