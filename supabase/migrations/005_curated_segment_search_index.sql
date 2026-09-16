create table if not exists public.scoutly_place_segments (
  segment text not null,
  place_id text not null references public.scoutly_places(id) on delete cascade,
  relevance smallint not null default 100,
  primary key (segment, place_id)
);

insert into public.scoutly_place_segments (segment, place_id, relevance)
select 'despachante', p.id, 100
from public.scoutly_places p
where (
    lower(coalesce(p.name, '')) like '%despachante%'
    or lower(coalesce(p.name, '')) like '%documentalista%'
    or lower(coalesce(p.name, '')) like '%documentação de veículo%'
    or lower(coalesce(p.name, '')) like '%documentacao de veiculo%'
    or lower(coalesce(p.name, '')) like '%documentação veicular%'
    or lower(coalesce(p.name, '')) like '%documentacao veicular%'
  )
  and (
    p.category = any(array['professional_service','financial_service','legal_service','automotive_service','government_department','corporate_or_business_office']::text[])
    or p.basic_category = any(array['professional_service','financial_service','legal_service','automotive_service','government_department','corporate_or_business_office']::text[])
    or p.taxonomy_primary = any(array['professional_service','financial_service','legal_service','automotive_service','government_department','corporate_or_business_office','automobile_registration_service','customs_broker']::text[])
  )
on conflict (segment, place_id) do update set relevance = excluded.relevance;

create or replace function public.search_scoutly_places_segment(
  p_segment text,
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
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
    s.relevance::integer
  from public.scoutly_place_segments s
  join public.scoutly_places p on p.id = s.place_id
  where s.segment = lower(p_segment)
    and p.geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
  order by s.relevance desc, p.confidence desc nulls last, p.name asc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$function$;
