create or replace function public.search_scoutly_places_precise(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_exact_categories text[] default '{}'::text[],
  p_exact_taxonomies text[] default '{}'::text[],
  p_broad_categories text[] default '{}'::text[],
  p_name_terms text[] default '{}'::text[],
  p_limit integer default 300
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
  with candidates as (
    select
      p.*,
      case
        when cardinality(p_exact_taxonomies) > 0
          and p.taxonomy_primary = any(p_exact_taxonomies) then 120
        when cardinality(p_exact_categories) > 0
          and (p.category = any(p_exact_categories) or p.basic_category = any(p_exact_categories)) then 110
        when cardinality(p_name_terms) > 0
          and exists (
            select 1
            from unnest(p_name_terms) as t(term)
            where lower(coalesce(p.name, '')) like '%' || lower(t.term) || '%'
          )
          and (
            cardinality(p_broad_categories) = 0
            or p.category = any(p_broad_categories)
            or p.basic_category = any(p_broad_categories)
            or p.taxonomy_primary = any(p_broad_categories)
          ) then 90
        else 0
      end as relevance
    from public.scoutly_places p
    where p.geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
      and (
        (cardinality(p_exact_taxonomies) > 0 and p.taxonomy_primary = any(p_exact_taxonomies))
        or (cardinality(p_exact_categories) > 0 and (p.category = any(p_exact_categories) or p.basic_category = any(p_exact_categories)))
        or (
          cardinality(p_name_terms) > 0
          and exists (
            select 1
            from unnest(p_name_terms) as t(term)
            where lower(coalesce(p.name, '')) like '%' || lower(t.term) || '%'
          )
          and (
            cardinality(p_broad_categories) = 0
            or p.category = any(p_broad_categories)
            or p.basic_category = any(p_broad_categories)
            or p.taxonomy_primary = any(p_broad_categories)
          )
        )
      )
  )
  select
    c.id,
    c.name,
    c.latitude,
    c.longitude,
    c.category,
    c.basic_category,
    c.taxonomy_primary,
    c.confidence,
    c.operating_status,
    c.website,
    c.websites,
    c.email,
    c.emails,
    c.phone,
    c.phones,
    c.socials,
    c.address,
    c.source,
    c.relevance
  from candidates c
  where c.relevance > 0
  order by c.relevance desc, c.confidence desc nulls last, c.name asc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$function$;
