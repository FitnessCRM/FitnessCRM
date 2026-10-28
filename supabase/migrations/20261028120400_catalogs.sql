-- Catalogs (Fase 2): the trainer's own food library, measurement types and questionnaire questions.
-- Source of truth: docs/dominio.md §4 (copia propia de alimentos), §5 (Composicion), §6 (I8, I13,
-- I15, I26, I28) and lib/domain/schemas/{food,measurement-type,questionnaire,catalog}.ts.
--
-- Entries are archived, never deleted (I13): no policy in this file grants delete.
-- The common food catalog is served by food-api (§12) and is not stored in this database.

create type public.food_status as enum ('activo', 'archivado');
create type public.food_publish_status as enum ('pendiente', 'publicado');
create type public.catalog_status as enum ('activa', 'archivada');
create type public.question_format_kind as enum ('escala', 'texto');

-- Own copy of a food (§4): the source of truth for its author. Composition is per 100 g (§5).
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  kcal integer not null check (kcal >= 0),
  protein_g numeric(4, 1) not null check (protein_g >= 0),
  carbs_g numeric(4, 1) not null check (carbs_g >= 0),
  fat_g numeric(4, 1) not null check (fat_g >= 0),
  status public.food_status not null default 'activo',
  publish_status public.food_publish_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_tenant_key unique (trainer_id, id),
  -- Physical limit, not a nutritional rule (§5): 100 g of food cannot hold more than 100 g of macros.
  constraint foods_macros_max check (protein_g + carbs_g + fat_g <= 100)
);

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

create index foods_trainer_status_idx on public.foods (trainer_id, status);

-- Measurement type (I8, I26). The unit is frozen once a measurement of this type exists.
-- has_measurements is raised by a trigger on review_measurements (20261028120600), never by the app.
create table public.measurement_types (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  label text not null check (length(btrim(label)) > 0),
  unit text not null check (length(btrim(unit)) > 0),
  sort_order integer not null check (sort_order >= 0),
  status public.catalog_status not null default 'activa',
  has_measurements boolean not null default false,
  created_at timestamptz not null default now(),
  constraint measurement_types_tenant_key unique (trainer_id, id)
);

create or replace function public.measurement_types_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.has_measurements and new.unit is distinct from old.unit then
    raise exception 'measurement unit is frozen after its first measurement (I26)'
      using errcode = 'check_violation';
  end if;
  if old.has_measurements and not new.has_measurements then
    raise exception 'has_measurements cannot be cleared (I26)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger measurement_types_guard
  before update on public.measurement_types
  for each row execute function public.measurement_types_guard();

-- Questionnaire question (I15). The format (kind and scale limits) is frozen after its first response.
create table public.questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  prompt text not null check (length(btrim(prompt)) > 0),
  format_kind public.question_format_kind not null,
  scale_min integer,
  scale_max integer,
  sort_order integer not null check (sort_order >= 0),
  status public.catalog_status not null default 'activa',
  has_responses boolean not null default false,
  created_at timestamptz not null default now(),
  constraint questionnaire_questions_tenant_key unique (trainer_id, id),
  constraint questionnaire_questions_format_check check (
    (format_kind = 'escala'
      and scale_min is not null and scale_max is not null
      and scale_min >= 0 and scale_max > scale_min)
    or (format_kind = 'texto' and scale_min is null and scale_max is null)
  )
);

create or replace function public.questionnaire_questions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.has_responses
    and (new.format_kind, new.scale_min, new.scale_max)
      is distinct from (old.format_kind, old.scale_min, old.scale_max) then
    raise exception 'question format is frozen after its first response (I15)'
      using errcode = 'check_violation';
  end if;
  if old.has_responses and not new.has_responses then
    raise exception 'has_responses cannot be cleared (I15)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger questionnaire_questions_guard
  before update on public.questionnaire_questions
  for each row execute function public.questionnaire_questions_guard();

-- Row level security. The trainer manages their own catalog. A client who is active reads the
-- catalog of their trainer to answer a review, and writes nothing here (§12, I8).

alter table public.foods enable row level security;

create policy foods_trainer_select on public.foods
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy foods_trainer_insert on public.foods
  for insert to authenticated
  with check (public.is_trainer_of(trainer_id));

create policy foods_trainer_update on public.foods
  for update to authenticated
  using (public.is_trainer_of(trainer_id))
  with check (public.is_trainer_of(trainer_id));

alter table public.measurement_types enable row level security;

create policy measurement_types_trainer_select on public.measurement_types
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy measurement_types_trainer_insert on public.measurement_types
  for insert to authenticated
  with check (public.is_trainer_of(trainer_id));

create policy measurement_types_trainer_update on public.measurement_types
  for update to authenticated
  using (public.is_trainer_of(trainer_id))
  with check (public.is_trainer_of(trainer_id));

create policy measurement_types_client_select on public.measurement_types
  for select to authenticated
  using (public.is_active_client() and trainer_id = (select public.current_trainer_id()));

alter table public.questionnaire_questions enable row level security;

create policy questionnaire_questions_trainer_select on public.questionnaire_questions
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy questionnaire_questions_trainer_insert on public.questionnaire_questions
  for insert to authenticated
  with check (public.is_trainer_of(trainer_id));

create policy questionnaire_questions_trainer_update on public.questionnaire_questions
  for update to authenticated
  using (public.is_trainer_of(trainer_id))
  with check (public.is_trainer_of(trainer_id));

create policy questionnaire_questions_client_select on public.questionnaire_questions
  for select to authenticated
  using (public.is_active_client() and trainer_id = (select public.current_trainer_id()));
