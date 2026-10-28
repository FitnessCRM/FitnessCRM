-- Paged reads done on the server (Fase 6, section 2): the trainer's client tracking and membership
-- table. Filtering, ordering, counting and paging happen here, not in the client. The functions are
-- security invoker: row level security applies to whoever calls them.
--
-- Source of truth: lib/domain/membership.ts (EXPIRING_SOON_DAYS, compareMembershipsForList,
-- membershipStanding, overlappingMembershipIds) and lib/domain/schemas/client.ts. The 7-day window
-- below repeats EXPIRING_SOON_DAYS: change both together.

-- Client tracking page (/clients). Order: new review first, then first name (Spanish collation),
-- then id. `current_membership` is the membership that contains `p_today`, the one membershipStanding
-- picks: the latest start, and among equal starts the latest creation.
create or replace function public.list_clients_tracking(
  p_trainer_id uuid,
  p_filter text,
  p_client_id uuid,
  p_today date,
  p_page integer,
  p_page_size integer
)
returns table (
  id uuid,
  trainer_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  goal text,
  level text,
  initial_notes text,
  status public.client_status,
  start_date date,
  review_every_days integer,
  macros_visible boolean,
  created_at timestamptz,
  routine_name text,
  new_review_week integer,
  last_review_at timestamptz,
  current_membership jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matching as (
    select
      c.*,
      (
        select max(rv.week_number)
        from public.reviews rv
        where rv.client_id = c.id and rv.status = 'enviada'
      ) as new_review_week
    from public.clients c
    where c.trainer_id = p_trainer_id
      and (p_client_id is null or c.id = p_client_id)
      and (p_filter = 'todos' or c.status::text = p_filter)
  ),
  page as (
    select mt.*
    from matching mt
    order by (mt.new_review_week is not null) desc, mt.first_name collate "es-x-icu", mt.id
    offset p_page * p_page_size
    limit p_page_size
  )
  select
    pg.id,
    pg.trainer_id,
    pg.first_name,
    pg.last_name,
    pg.email,
    pg.phone,
    pg.goal,
    pg.level,
    pg.initial_notes,
    pg.status,
    pg.start_date,
    pg.review_every_days,
    pg.macros_visible,
    pg.created_at,
    (
      select r.name
      from public.routines r
      where r.client_id = pg.id and r.status = 'activo'
    ) as routine_name,
    pg.new_review_week,
    (
      select max(rv.submitted_at)
      from public.reviews rv
      where rv.client_id = pg.id
    ) as last_review_at,
    (
      select jsonb_build_object(
        'id', m.id,
        'trainer_id', m.trainer_id,
        'client_id', m.client_id,
        'type', m.type,
        'start_date', m.start_date,
        'end_date', m.end_date,
        'payment_status', m.payment_status,
        'created_at', m.created_at
      )
      from public.memberships m
      where m.client_id = pg.id
        and m.start_date <= p_today
        and p_today <= m.end_date
      order by m.start_date desc, m.created_at desc
      limit 1
    ) as current_membership
  from page pg
  order by (pg.new_review_week is not null) desc, pg.first_name collate "es-x-icu", pg.id;
$$;

-- Membership table page (/memberships). Filters: 'all', 'unpaid' and 'expiring' (vigente hoy con el
-- fin a 7 días o menos, como isExpiringSoon). Order: inicio más reciente primero, id descendente.
-- `overlapping` is true when another membership of the same client shares a day with this one.
create or replace function public.list_memberships_with_clients(
  p_trainer_id uuid,
  p_client_id uuid,
  p_filter text,
  p_today date,
  p_page integer,
  p_page_size integer
)
returns table (
  id uuid,
  trainer_id uuid,
  client_id uuid,
  type public.membership_type,
  start_date date,
  end_date date,
  payment_status public.payment_status,
  created_at timestamptz,
  client_first_name text,
  client_last_name text,
  client_status public.client_status,
  overlapping boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.trainer_id,
    m.client_id,
    m.type,
    m.start_date,
    m.end_date,
    m.payment_status,
    m.created_at,
    c.first_name,
    c.last_name,
    c.status,
    exists (
      select 1
      from public.memberships o
      where o.client_id = m.client_id
        and o.id <> m.id
        and o.start_date <= m.end_date
        and m.start_date <= o.end_date
    ) as overlapping
  from public.memberships m
  join public.clients c on c.trainer_id = m.trainer_id and c.id = m.client_id
  where m.trainer_id = p_trainer_id
    and (p_client_id is null or m.client_id = p_client_id)
    and (
      p_filter = 'all'
      or (p_filter = 'unpaid' and m.payment_status = 'no_pagada')
      or (
        p_filter = 'expiring'
        and m.start_date <= p_today
        and p_today <= m.end_date
        and m.end_date - p_today <= 7
      )
    )
  order by m.start_date desc, m.id desc
  offset p_page * p_page_size
  limit p_page_size;
$$;

revoke all on function public.list_clients_tracking(uuid, text, uuid, date, integer, integer) from public, anon;
revoke all on function public.list_memberships_with_clients(uuid, uuid, text, date, integer, integer) from public, anon;
grant execute on function public.list_clients_tracking(uuid, text, uuid, date, integer, integer) to authenticated;
grant execute on function public.list_memberships_with_clients(uuid, uuid, text, date, integer, integer) to authenticated;
