-- Catalog writes that a plain update cannot express (Fase 6, section 3). Source of truth:
-- docs/dominio.md §7 (archivar, pendiente de publicar) and the ports in lib/data/ports/foods.ts and
-- lib/data/ports/catalogs.ts.

-- Archiving a food sends its copy back to pending publication (§7): the catalog must stop serving it.
-- An archived food gets no new version, so archiving it again changes nothing (I13).
create or replace function public.archive_food(p_food_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
begin
  select f.trainer_id into v_trainer from public.foods f where f.id = p_food_id;
  if not found or not public.is_trainer_of(v_trainer) then
    raise exception 'food.not_found';
  end if;

  update public.foods
    set status = 'archivado', publish_status = 'pendiente'
    where id = p_food_id and status <> 'archivado';
end;
$$;

-- Marks the version `p_version` of a food as published. Only effective while that version is still the
-- current one: a later write leaves it pending (§7). The version is compared to the millisecond, the
-- precision the app reads back; the database keeps microseconds.
create or replace function public.mark_food_published(p_food_id uuid, p_version timestamptz)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.foods
    set publish_status = 'publicado'
    where id = p_food_id
      and publish_status <> 'publicado'
      and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', p_version);
$$;

-- Reorders the catalog: the position in `p_ordered_ids` becomes `sort_order` (0 first). Ids not listed keep
-- their order. Row level security limits the update to the caller's own rows.
create or replace function public.reorder_measurement_types(p_ordered_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.measurement_types mt
    set sort_order = o.ord - 1
    from unnest(p_ordered_ids) with ordinality as o(id, ord)
    where mt.id = o.id;
$$;

create or replace function public.reorder_questions(p_ordered_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.questionnaire_questions q
    set sort_order = o.ord - 1
    from unnest(p_ordered_ids) with ordinality as o(id, ord)
    where q.id = o.id;
$$;

revoke all on function public.mark_food_published(uuid, timestamptz) from public, anon;
revoke all on function public.reorder_measurement_types(uuid[]) from public, anon;
revoke all on function public.reorder_questions(uuid[]) from public, anon;
grant execute on function public.mark_food_published(uuid, timestamptz) to authenticated;
grant execute on function public.reorder_measurement_types(uuid[]) to authenticated;
grant execute on function public.reorder_questions(uuid[]) to authenticated;
revoke execute on function public.archive_food(uuid) from public, anon;
grant execute on function public.archive_food(uuid) to authenticated;
