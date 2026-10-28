-- Fase 6, sección 5: revisiones y registros.
-- Source of truth: docs/dominio.md §2 (WeightLog, WorkoutLog, Review), §8 (revisiones) e I16, I23, I25;
-- lib/data/ports/{reviews,weight-logs,workout-logs}.ts.

-- Una serie por línea prescrita, fecha y número de serie (§2). Es la identidad que hace de «guardar o
-- sustituir» una serie un upsert, en vez de una búsqueda previa.
create unique index workout_logs_series_key
  on public.workout_logs (client_id, routine_day_exercise_id, log_date, set_number);

-- Cotejo de texto para buscar: sin tildes ni mayúsculas. Cubre las letras del español; es lo que
-- `foldText` hace en el dominio para el mismo fin.
create or replace function public.fold_text(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(value), 'áéíóúàèìòùüñ', 'aeiouaeiouun');
$$;

-- Una página de las revisiones recibidas (no borradores) del entrenador, con sus contadores. Devuelve
-- los ids de la página en su orden, y los contadores por estado dentro de la búsqueda, sin paginar.
-- Orden: las enviadas primero, y luego por envío, la más reciente antes. Corre como el que llama (RLS).
create or replace function public.list_reviews_tracking(
  p_trainer_id uuid,
  p_filter text,
  p_search text,
  p_page integer,
  p_page_size integer
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    select public.fold_text(btrim(coalesce(p_search, ''))) as value
  ),
  received as (
    select r.id, r.status, r.submitted_at
    from public.reviews r
    join public.clients c on c.id = r.client_id
    cross join needle n
    where r.trainer_id = p_trainer_id
      and r.status <> 'borrador'
      and (
        n.value = ''
        or position(n.value in public.fold_text(c.first_name || ' ' || c.last_name)) > 0
      )
  )
  select jsonb_build_object(
    'ids', to_jsonb(array(
      select r.id
      from received r
      where p_filter = 'todas' or r.status::text = p_filter
      order by (r.status = 'enviada') desc, r.submitted_at desc nulls last, r.id
      limit p_page_size offset p_page * p_page_size
    )),
    'counts', jsonb_build_object(
      'todas', (select count(*) from received),
      'enviada', (select count(*) from received where status = 'enviada'),
      'vista', (select count(*) from received where status = 'vista'),
      'revisada', (select count(*) from received where status = 'revisada')
    )
  );
$$;

revoke execute on function public.fold_text(text) from public, anon;
revoke execute on function public.list_reviews_tracking(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.fold_text(text) to authenticated;
grant execute on function public.list_reviews_tracking(uuid, text, text, integer, integer) to authenticated;
