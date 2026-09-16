create or replace function public.search_scoutly_places_name_precise(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_name_term text,
  p_limit integer default 450
)
returns table(
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
  source text,
  relevance integer
)
language sql
stable
as $function$
  select
    p.id,
    p.name,
    p.latitude,
    p.longitude,
    p.category,
    p.basic_category,
    p.taxonomy_primary,
    p.confidence,
    p.operating_status,
    p.website,
    p.websites,
    p.email,
    p.emails,
    p.phone,
    p.phones,
    p.socials,
    p.address,
    p.source,
    90::integer as relevance
  from public.scoutly_places p
  where p.geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
    and lower(coalesce(p.name, '')) like '%' || lower(p_name_term) || '%'
  order by p.confidence desc nulls last, p.name asc
  limit greatest(1, least(coalesce(p_limit, 450), 750));
$function$;
