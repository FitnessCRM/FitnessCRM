-- Fase 5: RPC for the multi-row operations (plan de migración, Fase 5).
-- Source of truth: lib/domain/review.ts, lib/domain/week.ts and docs/dominio.md §5–§8 and I5, I9,
-- I12, I17, I20, I22–I24, I29.
--
-- Every function is security definer because it touches several rows that the caller's policies
-- would block one by one. A definer skips RLS, so each function checks the caller itself with the same
-- helpers the policies use (is_trainer_of, is_active_client, is_writable_client).
--
-- Business errors are raised with the domain code as the message (errcode P0001), so the adapter can
-- map them without parsing text.

-- I20: the feedback video is an external http(s) link. The column had no check until now.
alter table public.reviews
  add constraint reviews_feedback_url_check
  check (feedback_video_url is null or feedback_video_url ~* '^https?://\S+$');

-- Archiving an exercise never deletes a line that a WorkoutLog points at: active routines are versioned,
-- and drafts never have logs (a log points at the routine it was done on). So workout_logs_line_fk keeps
-- its NO ACTION reference.

-- Plans ----------------------------------------------------------------------------------------

-- Activates a draft routine and archives the active one of the same client (I4).
create or replace function public.activate_routine(p_routine_id uuid)
returns uuid
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

  -- Archive the previous version before activating this one: one active routine per client (I4).
  update public.routines
    set status = 'archivado'
    where client_id = v_routine.client_id and status = 'activo';

  update public.routines set status = 'activo' where id = p_routine_id;
  return p_routine_id;
end;
$$;

-- Copies the active routine into a new draft. The day and line ids stay the same, so each line keeps
-- its identity across versions (§7).
create or replace function public.revise_routine(p_routine_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.routines;
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

  return public.clone_routine(p_routine_id, null);
end;
$$;

-- Copies a routine into a new draft, with the same day and line ids, so each line keeps its identity
-- across versions (§7). The lines of p_skip_exercise_id are left out. It checks nothing: the functions
-- that call it check the caller first, and no role is granted it directly.
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

  insert into public.routines (trainer_id, client_id, status, name, note, source_template_name)
    values (v_source.trainer_id, v_source.client_id, 'borrador', v_source.name, v_source.note, v_source.source_template_name)
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

-- Clones a routine template into a new draft for the client (§4). The template body is read in
-- place; nothing is linked afterwards.
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
  if not public.is_writable_client(p_client_id) then
    raise exception 'client.not_writable';
  end if;

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

-- Publishes the drafts of one day type and archives the active set of that day type (§7, I4).
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

-- Copies an active menu, with its meals and items, into a new draft. Same ids, as with routines.
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

  insert into public.menus (trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g, note, source_template_name)
    values (v_source.trainer_id, v_source.client_id, 'borrador', v_source.name, v_source.day_type, v_source.suggested,
      v_source.kcal, v_source.protein_g, v_source.carbs_g, v_source.fat_g, v_source.note, v_source.source_template_name)
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

create or replace function public.archive_menu(p_menu_id uuid)
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
  if not public.is_writable_client(v_menu.client_id) then
    raise exception 'client.not_writable';
  end if;

  update public.menus set status = 'archivado' where id = p_menu_id;
end;
$$;

-- Clones a menu template into draft menus for the client. Each library item keeps its frozen name
-- and composition as they are in the template (I29).
create or replace function public.assign_menu_template(p_template_id uuid, p_client_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.menu_templates;
  v_menu uuid;
  v_entry jsonb;
  v_count integer := 0;
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

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Sets the daily targets of one day type. The previous active target of that day type is archived
-- first, so there is never more than one active (I4).
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
  if not public.is_writable_client(p_client_id) then
    raise exception 'client.not_writable';
  end if;

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
  if not (
    public.is_writable_client(p_client_id)
    or (public.is_active_client() and p_client_id = (select public.current_client_id()))
  ) then
    raise exception 'client.not_writable';
  end if;

  update public.clients set macros_visible = p_visible where id = p_client_id;
end;
$$;

-- Reviews --------------------------------------------------------------------------------------

-- Opens (or returns) the review of the current week of the calling client (§8, I16, I22, I5). The week
-- and the window are computed in the trainer's time zone and frozen. The requirements are the active
-- entries of the catalog at this moment.
create or replace function public.open_current_review()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_time_zone text;
  v_today date;
  v_week integer;
  v_start date;
  v_id uuid;
begin
  if not public.is_active_client() then
    raise exception 'client.not_active';
  end if;

  select * into v_client from public.clients where id = (select public.current_client_id());
  select t.time_zone into v_time_zone from public.trainers t where t.id = v_client.trainer_id;

  v_today := (now() at time zone v_time_zone)::date;
  if v_today < v_client.start_date then
    raise exception 'week.before_start';
  end if;

  v_week := (v_today - v_client.start_date) / 7 + 1;
  v_start := v_client.start_date + (v_week - 1) * 7;

  select r.id into v_id from public.reviews r where r.client_id = v_client.id and r.week_number = v_week;
  if found then
    return v_id;
  end if;

  insert into public.reviews (trainer_id, client_id, week_number, window_start, window_end, status, required_measurement_type_ids, required_question_ids)
    values (
      v_client.trainer_id, v_client.id, v_week, v_start, v_start + 6, 'borrador',
      coalesce((select array_agg(t.id order by t.sort_order) from public.measurement_types t
        where t.trainer_id = v_client.trainer_id and t.status = 'activa'), '{}'),
      coalesce((select array_agg(q.id order by q.sort_order) from public.questionnaire_questions q
        where q.trainer_id = v_client.trainer_id and q.status = 'activa'), '{}')
    )
    on conflict (client_id, week_number) do nothing
    returning id into v_id;

  if v_id is null then
    select r.id into v_id from public.reviews r where r.client_id = v_client.id and r.week_number = v_week;
  end if;

  return v_id;
end;
$$;

-- Saves the client's draft of a review (I17: only while borrador or enviada). The draft replaces what
-- it names: a measurement or answer left out of the list is removed. Frozen copies follow I12: the
-- label, unit, prompt and format are copied when the value is recorded or changes, and kept otherwise.
create or replace function public.save_review_draft(p_review_id uuid, p_draft jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews;
  v_item jsonb;
  v_type public.measurement_types;
  v_question public.questionnaire_questions;
  v_log public.weight_logs;
  v_ids uuid[];
  v_weight_log_id uuid;
  v_text text;
  v_num numeric;
begin
  select * into v_review from public.reviews where id = p_review_id;
  if not found or not public.is_active_client() or v_review.client_id <> (select public.current_client_id()) then
    raise exception 'review.not_found';
  end if;
  if v_review.status not in ('borrador', 'enviada') then
    raise exception 'review.not_editable';
  end if;

  if p_draft ? 'weightLogId' then
    if jsonb_typeof(p_draft->'weightLogId') = 'null' then
      v_weight_log_id := null;
    else
      select * into v_log from public.weight_logs
        where id = (p_draft->>'weightLogId')::uuid and client_id = v_review.client_id;
      if not found then
        raise exception 'weight_log.not_found';
      end if;
      -- I9: the weigh-in has to fall inside the review window.
      if v_log.log_date < v_review.window_start or v_log.log_date > v_review.window_end then
        raise exception 'weight_log.outside_window';
      end if;
      v_weight_log_id := v_log.id;
    end if;
    update public.reviews set weight_log_id = v_weight_log_id where id = p_review_id;
  end if;

  if p_draft ? 'measurements' then
    v_ids := '{}';
    for v_item in select value from jsonb_array_elements(p_draft->'measurements') loop
      if jsonb_typeof(v_item->'value') <> 'number' then
        raise exception 'measurement.invalid_value';
      end if;
      select * into v_type from public.measurement_types
        where id = (v_item->>'measurementTypeId')::uuid and trainer_id = v_review.trainer_id;
      if not found then
        raise exception 'measurement.unknown_type';
      end if;
      if v_type.id = any (v_ids) then
        raise exception 'measurement.duplicate';
      end if;
      v_ids := v_ids || v_type.id;

      insert into public.review_measurements (trainer_id, review_id, measurement_type_id, value, label, unit)
        values (v_review.trainer_id, p_review_id, v_type.id, (v_item->>'value')::numeric, v_type.label, v_type.unit)
        on conflict (review_id, measurement_type_id) do update
          set value = excluded.value, label = excluded.label, unit = excluded.unit
          where public.review_measurements.value is distinct from excluded.value;
    end loop;

    delete from public.review_measurements
      where review_id = p_review_id and measurement_type_id <> all (v_ids);
  end if;

  if p_draft ? 'responses' then
    v_ids := '{}';
    for v_item in select value from jsonb_array_elements(p_draft->'responses') loop
      select * into v_question from public.questionnaire_questions
        where id = (v_item->>'questionId')::uuid and trainer_id = v_review.trainer_id;
      if not found then
        raise exception 'response.unknown_question';
      end if;
      if v_question.id = any (v_ids) then
        raise exception 'response.duplicate';
      end if;
      v_ids := v_ids || v_question.id;

      if v_question.format_kind = 'escala' then
        if jsonb_typeof(v_item->'value') <> 'number' then
          raise exception 'response.not_integer';
        end if;
        v_num := (v_item->>'value')::numeric;
        if v_num <> trunc(v_num) then
          raise exception 'response.not_integer';
        end if;
        if v_num < v_question.scale_min or v_num > v_question.scale_max then
          raise exception 'response.out_of_range';
        end if;

        insert into public.questionnaire_responses (trainer_id, review_id, question_id, prompt, format_kind, scale_min, scale_max, value_number, value_text)
          values (v_review.trainer_id, p_review_id, v_question.id, v_question.prompt, 'escala', v_question.scale_min, v_question.scale_max, v_num::int, null)
          on conflict (review_id, question_id) do update
            set prompt = excluded.prompt, format_kind = excluded.format_kind,
              scale_min = excluded.scale_min, scale_max = excluded.scale_max,
              value_number = excluded.value_number, value_text = excluded.value_text
            where public.questionnaire_responses.value_number is distinct from excluded.value_number;
      else
        if jsonb_typeof(v_item->'value') <> 'string' then
          raise exception 'response.not_text';
        end if;
        v_text := v_item->>'value';

        insert into public.questionnaire_responses (trainer_id, review_id, question_id, prompt, format_kind, scale_min, scale_max, value_number, value_text)
          values (v_review.trainer_id, p_review_id, v_question.id, v_question.prompt, 'texto', null, null, null, v_text)
          on conflict (review_id, question_id) do update
            set prompt = excluded.prompt, format_kind = excluded.format_kind,
              scale_min = excluded.scale_min, scale_max = excluded.scale_max,
              value_number = excluded.value_number, value_text = excluded.value_text
            where public.questionnaire_responses.value_text is distinct from excluded.value_text;
      end if;
    end loop;

    delete from public.questionnaire_responses
      where review_id = p_review_id and question_id <> all (v_ids);
  end if;

  return p_review_id;
end;
$$;

-- Records a photo for a pose and returns the path it replaced, so the caller can remove that object
-- from Storage. One photo per pose (ReviewMedia).
create or replace function public.attach_review_media(p_review_id uuid, p_pose public.review_pose, p_storage_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews;
  v_replaced text;
begin
  select * into v_review from public.reviews where id = p_review_id;
  if not found or not public.is_active_client() or v_review.client_id <> (select public.current_client_id()) then
    raise exception 'review.not_found';
  end if;
  if v_review.status not in ('borrador', 'enviada') then
    raise exception 'review.not_editable';
  end if;
  -- The object must sit in this client's folder of the bucket (20261028120300).
  if split_part(p_storage_path, '/', 2) <> v_review.client_id::text then
    raise exception 'media.wrong_folder';
  end if;

  delete from public.review_media
    where review_id = p_review_id and pose = p_pose
    returning storage_path into v_replaced;

  insert into public.review_media (trainer_id, review_id, pose, storage_path)
    values (v_review.trainer_id, p_review_id, p_pose, p_storage_path);

  return v_replaced;
end;
$$;

-- I5: whether a review is complete, against its frozen requirements. It only reports; it never blocks.
-- The client reads it while drafting; the trainer only once the review is sent (§3, §7).
create or replace function public.review_completeness(p_review_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_review public.reviews;
  v_missing_poses text[];
  v_missing_types uuid[];
  v_missing_questions uuid[];
  v_weight_ok boolean;
begin
  select * into v_review from public.reviews where id = p_review_id;
  if not found or not (
    (public.is_trainer_of(v_review.trainer_id) and v_review.status <> 'borrador')
    or (public.is_active_client() and v_review.client_id = (select public.current_client_id()))
  ) then
    raise exception 'review.not_found';
  end if;

  v_missing_poses := array(
    select p from unnest(array['frente', 'perfil', 'espalda']::text[]) as p
    where p not in (select m.pose::text from public.review_media m where m.review_id = p_review_id)
  );
  v_missing_types := array(
    select t from unnest(v_review.required_measurement_type_ids) as t
    where t not in (select rm.measurement_type_id from public.review_measurements rm where rm.review_id = p_review_id)
  );
  v_missing_questions := array(
    select q from unnest(v_review.required_question_ids) as q
    where q not in (
      select qr.question_id from public.questionnaire_responses qr
      where qr.review_id = p_review_id
        and (qr.value_number is not null or btrim(coalesce(qr.value_text, '')) <> '')
    )
  );
  v_weight_ok := v_review.weight_log_id is not null;

  return jsonb_build_object(
    'complete', cardinality(v_missing_poses) = 0 and v_weight_ok
      and cardinality(v_missing_types) = 0 and cardinality(v_missing_questions) = 0,
    'blocks', jsonb_build_object(
      'photos', cardinality(v_missing_poses) = 0,
      'weight', v_weight_ok,
      'measurements', cardinality(v_missing_types) = 0,
      'questionnaire', cardinality(v_missing_questions) = 0
    ),
    'missing', jsonb_build_object(
      'poses', to_jsonb(v_missing_poses),
      'weight', not v_weight_ok,
      'measurementTypeIds', to_jsonb(v_missing_types),
      'questionIds', to_jsonb(v_missing_questions)
    )
  );
end;
$$;

-- The client sends the review: borrador → enviada. Completeness is reported, never enforced (§1.8).
create or replace function public.submit_review(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews;
begin
  select * into v_review from public.reviews where id = p_review_id;
  if not found or not public.is_active_client() or v_review.client_id <> (select public.current_client_id()) then
    raise exception 'review.not_found';
  end if;
  if v_review.status <> 'borrador' then
    raise exception 'review.invalid_transition';
  end if;

  update public.reviews set status = 'enviada', submitted_at = now() where id = p_review_id;

  return public.review_completeness(p_review_id);
end;
$$;

-- The trainer opens the review: enviada → vista. Copies the weight it points at (I24).
create or replace function public.mark_review_viewed(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews;
  v_log public.weight_logs;
begin
  select * into v_review from public.reviews where id = p_review_id;
  if not found or not public.is_trainer_of(v_review.trainer_id) then
    raise exception 'review.not_found';
  end if;
  if not public.is_writable_client(v_review.client_id) then
    raise exception 'client.not_writable';
  end if;
  if v_review.status <> 'enviada' then
    raise exception 'review.invalid_transition';
  end if;

  if v_review.weight_log_id is null then
    update public.reviews set status = 'vista', viewed_at = now() where id = p_review_id;
  else
    select * into v_log from public.weight_logs where id = v_review.weight_log_id;
    update public.reviews
      set status = 'vista', viewed_at = now(),
        frozen_weight_kg = v_log.weight_kg, frozen_weight_date = v_log.log_date
      where id = p_review_id;
  end if;
end;
$$;

-- The trainer sends the feedback: vista → revisada. The video is an external link (I20).
create or replace function public.send_review_feedback(p_review_id uuid, p_video_url text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews;
begin
  select * into v_review from public.reviews where id = p_review_id;
  if not found or not public.is_trainer_of(v_review.trainer_id) then
    raise exception 'review.not_found';
  end if;
  if not public.is_writable_client(v_review.client_id) then
    raise exception 'client.not_writable';
  end if;
  if v_review.status <> 'vista' then
    raise exception 'review.invalid_transition';
  end if;
  if p_video_url is not null and p_video_url !~* '^https?://\S+$' then
    raise exception 'review.feedback_invalid_url';
  end if;

  update public.reviews
    set status = 'revisada', feedback_video_url = p_video_url,
      feedback_note = coalesce(p_note, ''), reviewed_at = now()
    where id = p_review_id;
end;
$$;

-- Invitations and archiving ----------------------------------------------------------------------

-- A trainer invited by the platform accepts: creates the trainer row and its profile, and marks the
-- invitation accepted, in one transaction (§12). The caller is the new account, with a verified email.
create or replace function public.accept_trainer_invitation()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_invitation public.trainer_invitations;
begin
  if v_user is null or v_email = '' then
    raise exception 'invitation.not_found';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null) then
    raise exception 'invitation.email_not_verified';
  end if;
  if exists (select 1 from public.profiles p where p.user_id = v_user) then
    raise exception 'invitation.already_registered';
  end if;

  select * into v_invitation from public.trainer_invitations
    where email = v_email and status = 'invitado'
    for update;
  if not found then
    raise exception 'invitation.not_found';
  end if;

  insert into public.trainers (id, name, email, time_zone)
    values (v_user, v_invitation.name, v_invitation.email, v_invitation.time_zone);

  insert into public.profiles (user_id, role, trainer_id)
    values (v_user, 'trainer', v_user);

  update public.trainer_invitations
    set status = 'aceptada', trainer_id = v_user, accepted_at = now()
    where email = v_email;

  return v_user;
end;
$$;

-- Archives an exercise and takes its lines out of the routines of the clients that can be changed (§7).
-- A draft loses them in place; an active routine is replaced by a new version without them (§5), so the
-- archived one keeps its history. Returns the affected clients, so the caller can warn before and after.
create or replace function public.archive_exercise(p_exercise_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exercise public.exercises;
  v_routine record;
  v_new uuid;
  v_clients uuid[];
begin
  select * into v_exercise from public.exercises where id = p_exercise_id;
  if not found or not public.is_trainer_of(v_exercise.trainer_id) then
    raise exception 'exercise.not_found';
  end if;

  select coalesce(array_agg(distinct r.client_id), '{}') into v_clients
    from public.routine_day_exercises rde
    join public.routines r on r.id = rde.routine_id
    where rde.exercise_id = p_exercise_id
      and r.status in ('borrador', 'activo')
      and public.is_writable_client(r.client_id);

  for v_routine in
    select distinct r.id, r.status
    from public.routine_day_exercises rde
    join public.routines r on r.id = rde.routine_id
    where rde.exercise_id = p_exercise_id
      and r.status in ('borrador', 'activo')
      and public.is_writable_client(r.client_id)
  loop
    if v_routine.status = 'activo' then
      -- The new version takes the place of the active one. The old one is archived first: one active
      -- routine per client (I4).
      v_new := public.clone_routine(v_routine.id, p_exercise_id);
      update public.routines set status = 'archivado' where id = v_routine.id;
      update public.routines set status = 'activo' where id = v_new;
    else
      delete from public.routine_day_exercises
        where routine_id = v_routine.id and exercise_id = p_exercise_id;
    end if;
  end loop;

  update public.exercises set status = 'archivado' where id = p_exercise_id;

  return v_clients;
end;
$$;

-- Grants: the RPC run for the signed-in role only. Anonymous callers and PUBLIC get nothing.
revoke execute on function public.activate_routine(uuid) from public, anon;
revoke execute on function public.revise_routine(uuid) from public, anon;
revoke execute on function public.assign_routine_template(uuid, uuid) from public, anon;
revoke execute on function public.activate_menus(uuid, public.day_type) from public, anon;
revoke execute on function public.revise_menu(uuid) from public, anon;
revoke execute on function public.archive_menu(uuid) from public, anon;
revoke execute on function public.assign_menu_template(uuid, uuid) from public, anon;
revoke execute on function public.set_macro_targets(uuid, public.day_type, integer, numeric, numeric, numeric) from public, anon;
revoke execute on function public.set_macros_visible(uuid, boolean) from public, anon;
revoke execute on function public.open_current_review() from public, anon;
revoke execute on function public.save_review_draft(uuid, jsonb) from public, anon;
revoke execute on function public.attach_review_media(uuid, public.review_pose, text) from public, anon;
revoke execute on function public.review_completeness(uuid) from public, anon;
revoke execute on function public.submit_review(uuid) from public, anon;
revoke execute on function public.mark_review_viewed(uuid) from public, anon;
revoke execute on function public.send_review_feedback(uuid, text, text) from public, anon;
revoke execute on function public.accept_trainer_invitation() from public, anon;
revoke execute on function public.archive_exercise(uuid) from public, anon;

-- clone_routine checks nothing, so no signed-in role may call it directly.
revoke all on function public.clone_routine(uuid, uuid) from public, anon, authenticated;

-- Explicit, not left to the default privileges of the project.
grant execute on function public.activate_routine(uuid) to authenticated;
grant execute on function public.revise_routine(uuid) to authenticated;
grant execute on function public.assign_routine_template(uuid, uuid) to authenticated;
grant execute on function public.activate_menus(uuid, public.day_type) to authenticated;
grant execute on function public.revise_menu(uuid) to authenticated;
grant execute on function public.archive_menu(uuid) to authenticated;
grant execute on function public.assign_menu_template(uuid, uuid) to authenticated;
grant execute on function public.set_macro_targets(uuid, public.day_type, integer, numeric, numeric, numeric) to authenticated;
grant execute on function public.set_macros_visible(uuid, boolean) to authenticated;
grant execute on function public.open_current_review() to authenticated;
grant execute on function public.save_review_draft(uuid, jsonb) to authenticated;
grant execute on function public.attach_review_media(uuid, public.review_pose, text) to authenticated;
grant execute on function public.review_completeness(uuid) to authenticated;
grant execute on function public.submit_review(uuid) to authenticated;
grant execute on function public.mark_review_viewed(uuid) to authenticated;
grant execute on function public.send_review_feedback(uuid, text, text) to authenticated;
grant execute on function public.accept_trainer_invitation() to authenticated;
grant execute on function public.archive_exercise(uuid) to authenticated;
