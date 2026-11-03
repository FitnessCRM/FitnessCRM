-- I32 (E9, docs/dominio.md §6 and §7, 03-11-2026): at most one draft per client and plan kind.
-- Assigning a template over an existing draft raises `plan.draft_exists`; with `p_replace_draft` the
-- trainer has confirmed and the draft is deleted (a draft has no history). For menus the draft set is
-- per day type, so only the day types the template brings collide.
--
-- It is checked here and not with a unique index: versioning an active routine or archiving an
-- exercise creates a new draft for a moment (clone_routine) while another may exist, and the editor
-- already reuses its draft instead of making a second one (routinePublishOp).

drop function public.assign_routine_template(uuid, uuid);
drop function public.assign_menu_template(uuid, uuid);

create function public.assign_routine_template(
  p_template_id uuid,
  p_client_id uuid,
  p_replace_draft boolean default false
)
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

  -- I32: at most one draft routine per client. Replacing deletes it: a draft has no history.
  if exists (select 1 from public.routines where client_id = p_client_id and status = 'borrador') then
    if not p_replace_draft then
      raise exception 'plan.draft_exists';
    end if;
    delete from public.routines where client_id = p_client_id and status = 'borrador';
  end if;

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

create function public.assign_menu_template(
  p_template_id uuid,
  p_client_id uuid,
  p_replace_draft boolean default false
)
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

  -- I32: one draft set per client and day type. Only the day types the template brings collide.
  if exists (
    select 1 from public.menus
    where client_id = p_client_id and status = 'borrador'
      and day_type in (
        select (e->>'dayType')::public.day_type
        from jsonb_array_elements(coalesce(v_template.body->'menus', '[]'::jsonb)) as e
      )
  ) then
    if not p_replace_draft then
      raise exception 'plan.draft_exists';
    end if;
    delete from public.menus
      where client_id = p_client_id and status = 'borrador'
        and day_type in (
          select (e->>'dayType')::public.day_type
          from jsonb_array_elements(coalesce(v_template.body->'menus', '[]'::jsonb)) as e
        );
  end if;

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

revoke execute on function public.assign_routine_template(uuid, uuid, boolean) from public, anon;
revoke execute on function public.assign_menu_template(uuid, uuid, boolean) from public, anon;
grant execute on function public.assign_routine_template(uuid, uuid, boolean) to authenticated;
grant execute on function public.assign_menu_template(uuid, uuid, boolean) to authenticated;
