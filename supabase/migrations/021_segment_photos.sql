-- One Unsplash photo per business segment, fetched once and reused by the chest cards.
-- Written only by the server (service key); RLS enabled with no policies on purpose.
create table if not exists public.segment_photos (
  segment text primary key,
  src text not null,
  width integer,
  height integer,
  credit text,
  credit_url text,
  created_at timestamptz not null default now()
);

alter table public.segment_photos enable row level security;

notify pgrst, 'reload schema';
