-- Fase 6, sección 4: escritura de planes como una sola operación. Un borrador de rutina o de menú
-- (cabecera, días o comidas, líneas o alimentos) se guarda en una transacción: sin esto, un fallo a
-- mitad dejaría un plan a medio escribir.
-- Source of truth: docs/dominio.md §5 (Prescripcion, FoodItem), §6 (I3, I4, I29, I30), §7 (ciclos de
-- vida) y lib/data/adapters/firebase/plans.ts, que es la referencia de comportamiento.
--
-- Como en rpc.sql, cada función comprueba al que llama con los mismos helpers que las políticas.
-- Los errores de negocio salen como código de dominio (P0001).

-- Helpers ---------------------------------------------------------------------------------------

-- Inserta los días y las líneas de una rutina a partir de su cuerpo (RoutineBody). Los ids son los
-- del cuerpo: así cada línea conserva su identidad entre versiones (§7). Sin comprobaciones: solo lo
-- llaman las funciones de abajo, que ya han comprobado al que llama.
create or replace function public.put_routine_body(p_routine_id uuid, p_trainer_id uuid, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.routine_days (routine_id, id, trainer_id, position, day_number, label)
    select p_routine_id, (d.day->>'id')::uuid, p_trainer_id, d.dord - 1,
      (d.day->>'dayNumber')::int, coalesce(d.day->>'label', '')
    from jsonb_array_elements(coalesce(p_body->'days', '[]'::jsonb)) with ordinality as d(day, dord);

  insert into public.routine_day_exercises (routine_id, id, routine_day_id, trainer_id, exercise_id, position, sets, reps_min, reps_max, rir, rest, note)
    select p_routine_id, (e.line->>'id')::uuid, (d.day->>'id')::uuid, p_trainer_id,
      (e.line->>'exerciseId')::uuid, e.lord - 1,
      (e.line->'prescription'->>'sets')::int,
      (e.line->'prescription'->>'repsMin')::int,
      nullif(e.line->'prescription'->>'repsMax', '')::int,
      coalesce(e.line->'prescription'->>'rir', ''),
      coalesce(e.line->'prescription'->>'rest', ''),
      coalesce(e.line->'prescription'->>'note', '')
    from jsonb_array_elements(coalesce(p_body->'days', '[]'::jsonb)) with ordinality as d(day, dord)
    cross join lateral jsonb_array_elements(coalesce(d.day->'exercises', '[]'::jsonb)) with ordinality as e(line, lord);
end;
$$;

-- Igual para un menú: sus comidas y los alimentos de cada comida. Un alimento de la biblioteca lleva
-- su id y su copia congelada (I29); uno de texto libre no lleva ni una cosa ni la otra (I30).
create or replace function public.put_menu_meals(p_menu_id uuid, p_trainer_id uuid, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.meals (menu_id, id, trainer_id, position, name)
    select p_menu_id, (m.meal->>'id')::uuid, p_trainer_id, m.mord - 1, m.meal->>'name'
    from jsonb_array_elements(coalesce(p_body->'meals', '[]'::jsonb)) with ordinality as m(meal, mord);

  insert into public.menu_items (menu_id, meal_id, id, trainer_id, position, name, grams, food_id, kcal, protein_g, carbs_g, fat_g)
    select p_menu_id, (m.meal->>'id')::uuid, (i.item->>'id')::uuid, p_trainer_id, i.iord - 1,
      i.item->>'name', (i.item->>'grams')::numeric,
      nullif(i.item->>'foodId', '')::uuid,
      (i.item->'composition'->>'kcal')::int,
      (i.item->'composition'->>'proteinG')::numeric,
      (i.item->'composition'->>'carbsG')::numeric,
      (i.item->'composition'->>'fatG')::numeric
    from jsonb_array_elements(coalesce(p_body->'meals', '[]'::jsonb)) as m(meal)
    cross join lateral jsonb_array_elements(coalesce(m.meal->'items', '[]'::jsonb)) with ordinality as i(item, iord);
end;
$$;

-- Rutinas ---------------------------------------------------------------------------------------

-- Borrador nuevo para un cliente, con el cuerpo dado.
create or replace function public.create_routine_draft(p_client_id uuid, p_body jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
  v_new uuid;
begin
  if not public.is_writable_client(p_client_id) then
    raise exception 'client.not_writable';
  end if;

  select c.trainer_id into v_trainer from public.clients c where c.id = p_client_id;

  insert into public.routines (trainer_id, client_id, status, name, note, source_template_name)
    values (v_trainer, p_client_id, 'borrador', p_body->>'name', coalesce(p_body->>'note', ''), null)
    returning id into v_new;

  perform public.put_routine_body(v_new, v_trainer, p_body);
  return v_new;
end;
$$;

-- Guarda el cuerpo de un borrador. Solo se edita en sitio un borrador (§7).
create or replace function public.replace_routine_draft(p_routine_id uuid, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_routine public.routines;
begin
  select * into v_routine from public.routines where id = p_routine_id;
  if not found or not public.is_trainer_of(v_routine.trainer_id) then
    raise exception 'routine.not_found';
  end if;
  if v_routine.status <> 'borrador' then
    raise exception 'routine.not_draft';
  end if;
  if not public.is_writable_client(v_routine.client_id) then
    raise exception 'client.not_writable';
  end if;

  update public.routines
    set name = p_body->>'name', note = coalesce(p_body->>'note', '')
    where id = p_routine_id;

  -- Los días se borran y se vuelven a escribir; sus líneas caen en cascada. Un borrador no tiene
  -- registros de entrenamiento apuntando a ellas.
  delete from public.routine_days where routine_id = p_routine_id;
  perform public.put_routine_body(p_routine_id, v_routine.trainer_id, p_body);
end;
$$;

-- Versión nueva de una rutina activa: un borrador con el cuerpo dado y la plantilla de origen
-- copiada (§7). La activa no cambia hasta que se active el borrador.
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

  insert into public.routines (trainer_id, client_id, status, name, note, source_template_name)
    values (v_source.trainer_id, v_source.client_id, 'borrador', p_body->>'name',
      coalesce(p_body->>'note', ''), v_source.source_template_name)
    returning id into v_new;

  perform public.put_routine_body(v_new, v_source.trainer_id, p_body);
  return v_new;
end;
$$;

-- Menús -----------------------------------------------------------------------------------------

create or replace function public.create_menu_draft(p_client_id uuid, p_body jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
  v_new uuid;
begin
  if not public.is_writable_client(p_client_id) then
    raise exception 'client.not_writable';
  end if;

  select c.trainer_id into v_trainer from public.clients c where c.id = p_client_id;

  insert into public.menus (trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g, note, source_template_name)
    values (v_trainer, p_client_id, 'borrador', p_body->>'name', (p_body->>'dayType')::public.day_type,
      (p_body->>'suggested')::boolean,
      (p_body->'macros'->>'kcal')::int, (p_body->'macros'->>'proteinG')::numeric,
      (p_body->'macros'->>'carbsG')::numeric, (p_body->'macros'->>'fatG')::numeric,
      coalesce(p_body->>'note', ''), null)
    returning id into v_new;

  perform public.put_menu_meals(v_new, v_trainer, p_body);
  return v_new;
end;
$$;

create or replace function public.replace_menu_draft(p_menu_id uuid, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_menu public.menus;
begin
  select * into v_menu from public.menus where id = p_menu_id;
  if not found or not public.is_trainer_of(v_menu.trainer_id) then
    raise exception 'menu.not_found';
  end if;
  if v_menu.status <> 'borrador' then
    raise exception 'menu.not_draft';
  end if;
  if not public.is_writable_client(v_menu.client_id) then
    raise exception 'client.not_writable';
  end if;

  update public.menus
    set name = p_body->>'name',
      day_type = (p_body->>'dayType')::public.day_type,
      suggested = (p_body->>'suggested')::boolean,
      kcal = (p_body->'macros'->>'kcal')::int,
      protein_g = (p_body->'macros'->>'proteinG')::numeric,
      carbs_g = (p_body->'macros'->>'carbsG')::numeric,
      fat_g = (p_body->'macros'->>'fatG')::numeric,
      note = coalesce(p_body->>'note', '')
    where id = p_menu_id;

  -- Las comidas se borran y se vuelven a escribir; sus alimentos caen en cascada.
  delete from public.meals where menu_id = p_menu_id;
  perform public.put_menu_meals(p_menu_id, v_menu.trainer_id, p_body);
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

  insert into public.menus (trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g, note, source_template_name)
    values (v_source.trainer_id, v_source.client_id, 'borrador', p_body->>'name',
      (p_body->>'dayType')::public.day_type, (p_body->>'suggested')::boolean,
      (p_body->'macros'->>'kcal')::int, (p_body->'macros'->>'proteinG')::numeric,
      (p_body->'macros'->>'carbsG')::numeric, (p_body->'macros'->>'fatG')::numeric,
      coalesce(p_body->>'note', ''), v_source.source_template_name)
    returning id into v_new;

  perform public.put_menu_meals(v_new, v_source.trainer_id, p_body);
  return v_new;
end;
$$;

-- Corrige activate_menus de rpc.sql: archivaba el conjunto activo aunque no hubiera borradores, y
-- dejaba al cliente sin menús de ese tipo. Ahora, sin borradores, falla y no toca nada (menu.no_drafts,
-- como en el dominio).
create or replace function public.activate_menus(p_client_id uuid, p_day_type public.day_type)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_writable_client(p_client_id) then
    raise exception 'client.not_writable';
  end if;

  if not exists (
    select 1 from public.menus
    where client_id = p_client_id and day_type = p_day_type and status = 'borrador'
  ) then
    raise exception 'menu.no_drafts';
  end if;

  update public.menus
    set status = 'archivado'
    where client_id = p_client_id and day_type = p_day_type and status = 'activo';

  update public.menus
    set status = 'activo'
    where client_id = p_client_id and day_type = p_day_type and status = 'borrador';
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

-- Clona una plantilla de menú en menús en borrador del cliente, y devuelve sus ids (antes devolvía el
-- número, y la aplicación no sabía qué menús leer). Misma lógica que en rpc.sql; cambia el retorno.
drop function public.assign_menu_template(uuid, uuid);

create function public.assign_menu_template(p_template_id uuid, p_client_id uuid)
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
  if not public.is_writable_client(p_client_id) then
    raise exception 'client.not_writable';
  end if;

  for v_entry in select value from jsonb_array_elements(coalesce(v_template.body->'menus', '[]'::jsonb)) loop
    insert into public.menus (trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g, note, source_template_name)
      values (v_template.trainer_id, p_client_id, 'borrador', v_entry->>'name',
        (v_entry->>'dayType')::public.day_type, (v_entry->>'suggested')::boolean,
        (v_entry->'macros'->>'kcal')::int, (v_entry->'macros'->>'proteinG')::numeric,
        (v_entry->'macros'->>'carbsG')::numeric, (v_entry->'macros'->>'fatG')::numeric,
        coalesce(v_entry->>'note', ''), v_template.name)
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

-- Grants ----------------------------------------------------------------------------------------

-- Los helpers no comprueban nada: no los llama nadie directamente.
revoke all on function public.put_routine_body(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.put_menu_meals(uuid, uuid, jsonb) from public, anon, authenticated;

revoke execute on function public.create_routine_draft(uuid, jsonb) from public, anon;
revoke execute on function public.replace_routine_draft(uuid, jsonb) from public, anon;
revoke execute on function public.revise_routine_draft(uuid, jsonb) from public, anon;
revoke execute on function public.create_menu_draft(uuid, jsonb) from public, anon;
revoke execute on function public.replace_menu_draft(uuid, jsonb) from public, anon;
revoke execute on function public.revise_menu_draft(uuid, jsonb) from public, anon;
revoke execute on function public.activate_menus(uuid, public.day_type) from public, anon;
revoke execute on function public.assign_menu_template(uuid, uuid) from public, anon;

grant execute on function public.assign_menu_template(uuid, uuid) to authenticated;
grant execute on function public.create_routine_draft(uuid, jsonb) to authenticated;
grant execute on function public.replace_routine_draft(uuid, jsonb) to authenticated;
grant execute on function public.revise_routine_draft(uuid, jsonb) to authenticated;
grant execute on function public.create_menu_draft(uuid, jsonb) to authenticated;
grant execute on function public.replace_menu_draft(uuid, jsonb) to authenticated;
grant execute on function public.revise_menu_draft(uuid, jsonb) to authenticated;
grant execute on function public.activate_menus(uuid, public.day_type) to authenticated;
