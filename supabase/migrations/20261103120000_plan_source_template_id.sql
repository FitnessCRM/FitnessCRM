-- E8 (docs/dominio.md §4, 03-11-2026): a plan keeps the id of the template it was cloned from, next
-- to the frozen name. It is not a live link (no foreign key): deleting the template leaves the id, and
-- editing it never touches the plan. Template uses are counted by id, not by name.
--
-- The functions that clone a template now write the id, and the ones that copy a plan into a new
-- version carry it over. Their bodies are the latest ones (rpc.sql, plan_writes.sql and
-- client_writes_not_found.sql) with only that column added.

alter table public.routines add column source_template_id uuid;
alter table public.menus add column source_template_id uuid;

create index routines_source_template_idx on public.routines (source_template_id)
  where source_template_id is not null;
create index menus_source_template_idx on public.menus (source_template_id)
  where source_template_id is not null;

create or replace function public.clone_routine(p_routine_id uuid, p_skip_exercise_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.routines;
  v_new uuid;
begin
  select * into v_source from public.routines where id = p_routine_id;

  insert into public.routines (trainer_id, client_id, status, name, note, source_template_name, source_template_id)
    values (v_source.trainer_id, v_source.client_id, 'borrador', v_source.name, v_source.note, v_source.source_template_name, v_source.source_template_id)
    returning id into v_new;

  insert into public.routine_days (routine_id, id, trainer_id, position, day_number, label)
    select v_new, d.id, d.trainer_id, d.position, d.day_number, d.label
    from public.routine_days d
    where d.routine_id = p_routine_id;

  insert into public.routine_day_exercises (routine_id, id, routine_day_id, trainer_id, exercise_id, position, sets, reps_min, reps_max, rir, rest, note)
    select v_new, e.id, e.routine_day_id, e.trainer_id, e.exercise_id, e.position, e.sets, e.reps_min, e.reps_max, e.rir, e.rest, e.note
    from public.routine_day_exercises e
    where e.routine_id = p_routine_id
      and e.exercise_id is distinct from p_skip_exercise_id;

  return v_new;
end;
$$;

create or replace function public.revise_menu(p_menu_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.menus;
  v_new uuid;
begin
  select * into v_source from public.menus where id = p_menu_id;
  if not found or not public.is_trainer_of(v_source.trainer_id) then
    raise exception 'menu.not_found';
  end if;
  if v_source.status <> 'activo' then
    raise exception 'menu.not_active';
  end if;
  if not public.is_writable_client(v_source.client_id) then
    raise exception 'client.not_writable';
  end if;

  insert into public.menus (trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g, note, source_template_name, source_template_id)
    values (v_source.trainer_id, v_source.client_id, 'borrador', v_source.name, v_source.day_type, v_source.suggested,
      v_source.kcal, v_source.protein_g, v_source.carbs_g, v_source.fat_g, v_source.note, v_source.source_template_name, v_source.source_template_id)
    returning id into v_new;

  insert into public.meals (menu_id, id, trainer_id, position, name)
    select v_new, m.id, m.trainer_id, m.position, m.name
    from public.meals m
    where m.menu_id = p_menu_id;

  insert into public.menu_items (menu_id, meal_id, id, trainer_id, position, name, grams, food_id, kcal, protein_g, carbs_g, fat_g)
    select v_new, i.meal_id, i.id, i.trainer_id, i.position, i.name, i.grams, i.food_id, i.kcal, i.protein_g, i.carbs_g, i.fat_g
    from public.menu_items i
    where i.menu_id = p_menu_id;

  return v_new;
end;
$$;

create or replace function public.revise_routine_draft(p_routine_id uuid, p_body jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.routines;
  v_new uuid;
begin
  select * into v_source from public.routines where id = p_routine_id;
  if not found or not public.is_trainer_of(v_source.trainer_id) then
    raise exception 'routine.not_found';
  end if;
  if v_source.status <> 'activo' then
    raise exception 'routine.not_active';
  end if;
  if not public.is_writable_client(v_source.client_id) then
    raise exception 'client.not_writable';
  end if;

  insert into public.routines (trainer_id, client_id, status, name, note, source_template_name, source_template_id)
    values (v_source.trainer_id, v_source.client_id, 'borrador', p_body->>'name',
      coalesce(p_body->>'note', ''), v_source.source_template_name, v_source.source_template_id)
    returning id into v_new;

  perform public.put_routine_body(v_new, v_source.trainer_id, p_body);
  return v_new;
end;
$$;

create or replace function public.revise_menu_draft(p_menu_id uuid, p_body jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.menus;
  v_new uuid;
begin
  select * into v_source from public.menus where id = p_menu_id;
  if not found or not public.is_trainer_of(v_source.trainer_id) then
    raise exception 'menu.not_found';
  end if;
  if v_source.status <> 'activo' then
    raise exception 'menu.not_active';
  end if;
  if not public.is_writable_client(v_source.client_id) then
    raise exception 'client.not_writable';
  end if;

  insert into public.menus (trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g, note, source_template_name, source_template_id)
    values (v_source.trainer_id, v_source.client_id, 'borrador', p_body->>'name',
      (p_body->>'dayType')::public.day_type, (p_body->>'suggested')::boolean,
      (p_body->'macros'->>'kcal')::int, (p_body->'macros'->>'proteinG')::numeric,
      (p_body->'macros'->>'carbsG')::numeric, (p_body->'macros'->>'fatG')::numeric,
      coalesce(p_body->>'note', ''), v_source.source_template_name, v_source.source_template_id)
    returning id into v_new;

  perform public.put_menu_meals(v_new, v_source.trainer_id, p_body);
  return v_new;
end;
$$;

create or replace function public.assign_menu_template(p_template_id uuid, p_client_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.menu_templates;
  v_menu uuid;
  v_entry jsonb;
  v_ids uuid[] := '{}';
begin
  select * into v_template from public.menu_templates where id = p_template_id;
  if not found or not public.is_trainer_of(v_template.trainer_id) then
    raise exception 'template.not_found';
  end if;
  perform public.assert_client_writable(p_client_id);

  for v_entry in select value from jsonb_array_elements(coalesce(v_template.body->'menus', '[]'::jsonb)) loop
    insert into public.menus (trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g, note, source_template_name, source_template_id)
      values (v_template.trainer_id, p_client_id, 'borrador', v_entry->>'name',
        (v_entry->>'dayType')::public.day_type, (v_entry->>'suggested')::boolean,
        (v_entry->'macros'->>'kcal')::int, (v_entry->'macros'->>'proteinG')::numeric,
        (v_entry->'macros'->>'carbsG')::numeric, (v_entry->'macros'->>'fatG')::numeric,
        coalesce(v_entry->>'note', ''), v_template.name, v_template.id)
      returning id into v_menu;

    insert into public.meals (menu_id, id, trainer_id, position, name)
      select v_menu, (m.meal->>'id')::uuid, v_template.trainer_id, m.mord - 1, m.meal->>'name'
      from jsonb_array_elements(coalesce(v_entry->'meals', '[]'::jsonb)) with ordinality as m(meal, mord);

    insert into public.menu_items (menu_id, meal_id, id, trainer_id, position, name, grams, food_id, kcal, protein_g, carbs_g, fat_g)
      select v_menu, (m.meal->>'id')::uuid, (i.item->>'id')::uuid, v_template.trainer_id, i.iord - 1,
        i.item->>'name', (i.item->>'grams')::numeric,
        nullif(i.item->>'foodId', '')::uuid,
        (i.item->'composition'->>'kcal')::int,
        (i.item->'composition'->>'proteinG')::numeric,
        (i.item->'composition'->>'carbsG')::numeric,
        (i.item->'composition'->>'fatG')::numeric
      from jsonb_array_elements(coalesce(v_entry->'meals', '[]'::jsonb)) as m(meal)
      cross join lateral jsonb_array_elements(coalesce(m.meal->'items', '[]'::jsonb)) with ordinality as i(item, iord);

    v_ids := v_ids || v_menu;
  end loop;

  return v_ids;
end;
$$;

create or replace function public.assign_routine_template(p_template_id uuid, p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.routine_templates;
  v_new uuid;
begin
  select * into v_template from public.routine_templates where id = p_template_id;
  if not found or not public.is_trainer_of(v_template.trainer_id) then
    raise exception 'template.not_found';
  end if;
  perform public.assert_client_writable(p_client_id);

  insert into public.routines (trainer_id, client_id, status, name, note, source_template_name, source_template_id)
    values (v_template.trainer_id, p_client_id, 'borrador', v_template.name,
      coalesce(v_template.body->>'note', ''), v_template.name, v_template.id)
    returning id into v_new;

  insert into public.routine_days (routine_id, id, trainer_id, position, day_number, label)
    select v_new, (d.day->>'id')::uuid, v_template.trainer_id, d.dord - 1,
      (d.day->>'dayNumber')::int, coalesce(d.day->>'label', '')
    from jsonb_array_elements(coalesce(v_template.body->'days', '[]'::jsonb)) with ordinality as d(day, dord);

  insert into public.routine_day_exercises (routine_id, id, routine_day_id, trainer_id, exercise_id, position, sets, reps_min, reps_max, rir, rest, note)
    select v_new, (e.line->>'id')::uuid, (d.day->>'id')::uuid, v_template.trainer_id,
      (e.line->>'exerciseId')::uuid, e.lord - 1,
      (e.line->'prescription'->>'sets')::int,
      (e.line->'prescription'->>'repsMin')::int,
      nullif(e.line->'prescription'->>'repsMax', '')::int,
      coalesce(e.line->'prescription'->>'rir', ''),
      coalesce(e.line->'prescription'->>'rest', ''),
      coalesce(e.line->'prescription'->>'note', '')
    from jsonb_array_elements(coalesce(v_template.body->'days', '[]'::jsonb)) with ordinality as d(day, dord)
    cross join lateral jsonb_array_elements(coalesce(d.day->'exercises', '[]'::jsonb)) with ordinality as e(line, lord);

  return v_new;
end;
$$;
