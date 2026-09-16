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
  with settings as (
    select
      greatest(1, least(coalesce(p_limit, 2000), 5000))::integer as safe_limit,
      greatest(
        4,
        least(
          20,
          ceil(sqrt(greatest(1, least(coalesce(p_limit, 2000), 5000))::numeric / 6.0))::integer
        )
      ) as grid_size
  ),
  candidates as (
    select
      p.*,
      s.safe_limit,
      s.grid_size,
      least(
        s.grid_size - 1,
        greatest(
          0,
          floor(((p.longitude - p_west) / nullif(p_east - p_west, 0)) * s.grid_size)::integer
        )
      ) as cell_x,
      least(
        s.grid_size - 1,
        greatest(
          0,
          floor(((p.latitude - p_south) / nullif(p_north - p_south, 0)) * s.grid_size)::integer
        )
      ) as cell_y
    from public.scoutly_places p
    cross join settings s
    where p.geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        partition by c.cell_x, c.cell_y
        order by c.confidence desc nulls last, c.id
      ) as cell_rank
    from candidates c
  ),
  balanced as (
    select r.*
    from ranked r
    where r.cell_rank <= greatest(
      2,
      ceil(r.safe_limit::numeric / nullif(r.grid_size * r.grid_size, 0))::integer
    )
  )
  select
    b.id,
    b.name,
    b.latitude,
    b.longitude,
    b.category,
    b.basic_category,
    b.taxonomy_primary,
    b.confidence,
    b.operating_status,
    b.website,
    b.websites,
    b.email,
    b.emails,
    b.phone,
    b.phones,
    b.socials,
    b.address,
    b.source
  from balanced b
  order by b.cell_rank, b.confidence desc nulls last, b.id
  limit (select safe_limit from settings);
$$;
