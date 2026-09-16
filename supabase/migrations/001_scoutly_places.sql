create extension if not exists postgis;

create table if not exists public.scoutly_places (
  id text primary key,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  geom geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored,
  category text,
  basic_category text,
  taxonomy_primary text,
  confidence double precision,
  operating_status text,
  website text,
  websites jsonb not null default '[]'::jsonb,
  email text,
  emails jsonb not null default '[]'::jsonb,
  phone text,
  phones jsonb not null default '[]'::jsonb,
  socials jsonb not null default '[]'::jsonb,
  address text,
  source text not null default 'Overture Maps',
  updated_at timestamptz not null default now()
);

create index if not exists idx_scoutly_places_geom on public.scoutly_places using gist (geom);
create index if not exists idx_scoutly_places_category on public.scoutly_places (category);
create index if not exists idx_scoutly_places_basic_category on public.scoutly_places (basic_category);
create index if not exists idx_scoutly_places_taxonomy_primary on public.scoutly_places (taxonomy_primary);
create index if not exists idx_scoutly_places_name_lower on public.scoutly_places (lower(name));

create or replace function public.search_scoutly_places(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_limit integer default 2000
)
returns table (
  id text,
  name text,
  latitude double precision,
  longitude double precision,
  category text,
  basic_category text,
  taxonomy_primary text,
  confidence double precision,
  operating_status text,
  website text,
  websites jsonb,
  email text,
  emails jsonb,
  phone text,
  phones jsonb,
  socials jsonb,
  address text,
  source text
)
language sql
stable
as $$
  select
    p.id, p.name, p.latitude, p.longitude, p.category, p.basic_category,
    p.taxonomy_primary, p.confidence, p.operating_status, p.website,
    p.websites, p.email, p.emails, p.phone, p.phones, p.socials,
    p.address, p.source
  from public.scoutly_places p
  where p.geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::geography
  order by p.confidence desc nulls last
  limit greatest(1, least(p_limit, 5000));
$$;
