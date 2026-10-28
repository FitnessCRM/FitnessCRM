-- A write that names a client of another trainer, or one that does not exist, answers `client.not_found`
-- (I1, I2 in lib/data/ports/index.ts): the answer must not say whether the id is in another portfolio.
-- Until now these RPCs raised `client.not_writable` for both cases, and the adapter passed it through.
--
-- `client.not_writable` stays for a client of this trainer that cannot take writes (dado de baja).
create or replace function public.assert_client_writable(p_client_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if public.is_writable_client(p_client_id) then
    return;
  end if;

  if exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and c.trainer_id = (select public.current_trainer_id())
  ) then
    raise exception 'client.not_writable';
  end if;

  raise exception 'client.not_found';
end;
$$;

revoke all on function public.assert_client_writable(uuid) from public, anon, authenticated;

-- The functions below only change the guard on the client id the caller passes. The rest of each body is
-- the one from its last migration.

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
  perform public.assert_client_writable(p_client_id);

  select c.trainer_id into v_trainer from public.clients c where c.id = p_client_id;

  insert into public.routines (trainer_id, client_id, status, name, note, source_template_name)
    values (v_trainer, p_client_id, 'borrador', p_body->>'name', coalesce(p_body->>'note', ''), null)
    returning id into v_new;

  perform public.put_routine_body(v_new, v_trainer, p_body);
  return v_new;
end;
$$;

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
  perform public.assert_client_writable(p_client_id);

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

create or replace function public.activate_menus(p_client_id uuid, p_day_type public.day_type)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public.assert_client_writable(p_client_id);

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

  insert into public.routines (trainer_id, client_id, status, name, note, source_template_name)
    values (v_template.trainer_id, p_client_id, 'borrador', v_template.name,
      coalesce(v_template.body->>'note', ''), v_template.name)
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

create or replace function public.set_macro_targets(
  p_client_id uuid,
  p_day_type public.day_type,
  p_kcal integer,
  p_protein_g numeric,
  p_carbs_g numeric,
  p_fat_g numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
  v_new uuid;
begin
  perform public.assert_client_writable(p_client_id);

  select c.trainer_id into v_trainer from public.clients c where c.id = p_client_id;

  update public.macro_targets
    set status = 'archivado'
    where client_id = p_client_id and day_type = p_day_type and status = 'activo';

  insert into public.macro_targets (trainer_id, client_id, day_type, status, kcal, protein_g, carbs_g, fat_g)
    values (v_trainer, p_client_id, p_day_type, 'activo', p_kcal, p_protein_g, p_carbs_g, p_fat_g)
    returning id into v_new;

  return v_new;
end;
$$;

-- I11: the trainer sets macrosVisible from the client's ficha, and the client sets it from their own
-- profile. Last write wins.
create or replace function public.set_macros_visible(p_client_id uuid, p_visible boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_active_client() and p_client_id = (select public.current_client_id())) then
    perform public.assert_client_writable(p_client_id);
  end if;

  update public.clients set macros_visible = p_visible where id = p_client_id;
end;
$$;

create or replace function public.renew_membership(
  p_client_id uuid,
  p_type public.membership_type,
  p_start_date date,
  p_payment_status public.payment_status
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
  v_months integer;
  v_new uuid;
begin
  perform public.assert_client_writable(p_client_id);

  select c.trainer_id into v_trainer from public.clients c where c.id = p_client_id;

  v_months := case p_type
    when 'mensual' then 1
    when 'trimestral' then 3
    when 'semestral' then 6
    when 'anual' then 12
  end;

  insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status)
    values (v_trainer, p_client_id, p_type, p_start_date,
      (p_start_date + make_interval(months => v_months))::date - 1, p_payment_status)
    returning id into v_new;

  return v_new;
end;
$$;
