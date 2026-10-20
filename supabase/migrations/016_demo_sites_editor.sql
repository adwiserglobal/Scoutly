-- Demo site editor: edits go to `draft` (autosaved to the cloud); "Publicar" copies draft -> data,
-- which is what the public /demo/<slug> page serves.
alter table public.demo_sites
  add column if not exists draft jsonb,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists published_at timestamptz;

update public.demo_sites set published_at = coalesce(published_at, created_at) where published_at is null;

notify pgrst, 'reload schema';
