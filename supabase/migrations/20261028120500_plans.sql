-- Client plans and templates (Fase 2 and 3): routines, menus, macro targets and their templates.
-- Source of truth: docs/dominio.md §4 (agregados), §5 (Prescripcion, FoodItem), §6 (I3, I4, I11,
-- I29), §7 (ciclos de vida) and lib/domain/schemas/{routine,menu,templates,macros,plan-status}.ts.
--
-- Rules:
-- - An active routine or menu is never edited in place (§7). Its lines, meals and items are writable
--   only while the parent is a draft, and a draft can only be saved still as a draft: activation and
--   archiving go through RPCs (Fase 5), because they touch several rows at once.
-- - Line and day ids are kept across versions (§7), so their primary key is (parent, id), not id.
-- - Templates keep their content in body jsonb and are cloned on assignment, never linked (§4).

create type public.plan_status as enum ('borrador', 'activo', 'archivado');
create type public.day_type as enum ('entrenamiento', 'descanso');

-- Routine assigned to a client (§4, §7). At most one active per client (I4).
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null,
  status public.plan_status not null default 'borrador',
  name text not null check (length(btrim(name)) > 0),
  note text not null default '',
  source_template_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_tenant_key unique (trainer_id, id),
  constraint routines_client_key unique (id, client_id),
  constraint routines_client_fk foreign key (trainer_id, client_id)
    references public.clients (trainer_id, id) on delete cascade
);

create unique index routines_one_active_per_client
  on public.routines (client_id)
  where status = 'activo';

create index routines_client_status_idx on public.routines (client_id, status);

create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

-- Day of a routine (Día 1, Día 2…). The order of the array is `position`; `day_number` is unique.
create table public.routine_days (
  routine_id uuid not null,
  id uuid not null default gen_random_uuid(),
  trainer_id uuid not null,
  position integer not null check (position >= 0),
  day_number integer not null check (day_number > 0),
  label text not null default '',
  primary key (routine_id, id),
  constraint routine_days_number_key unique (routine_id, day_number),
  constraint routine_days_routine_fk foreign key (trainer_id, routine_id)
    references public.routines (trainer_id, id) on delete cascade
);

-- Prescribed exercise inside a day (RoutineDayExercise). RIR and rest are free text on purpose (§5).
-- I3: the exercise belongs to the same trainer's library, enforced by the composite key.
-- Lines are not deleted while a WorkoutLog points at them: the reference is NO ACTION (see §2).
create table public.routine_day_exercises (
  routine_id uuid not null,
  id uuid not null default gen_random_uuid(),
  routine_day_id uuid not null,
  trainer_id uuid not null,
  exercise_id uuid not null,
  position integer not null check (position >= 0),
  sets integer not null check (sets > 0),
  reps_min integer not null check (reps_min > 0),
  reps_max integer check (reps_max is null or reps_max >= reps_min),
  rir text not null default '',
  rest text not null default '',
  note text not null default '',
  primary key (routine_id, id),
  constraint routine_day_exercises_day_fk foreign key (routine_id, routine_day_id)
    references public.routine_days (routine_id, id) on delete cascade,
  constraint routine_day_exercises_routine_fk foreign key (trainer_id, routine_id)
    references public.routines (trainer_id, id) on delete cascade,
  constraint routine_day_exercises_exercise_fk foreign key (trainer_id, exercise_id)
    references public.exercises (trainer_id, id)
);

create index routine_day_exercises_exercise_idx on public.routine_day_exercises (exercise_id);

-- Routine template (no client). Body: { note, days } as in RoutineBody. Cloned on assignment (§4).
create table public.routine_templates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routine_templates_tenant_key unique (trainer_id, id)
);

create trigger routine_templates_set_updated_at
  before update on public.routine_templates
  for each row execute function public.set_updated_at();

-- Menu assigned to a client (§3, §5). Its macros are declared by the trainer, never derived (§5).
-- Several menus per day type; one of the active set is the suggested one (§3).
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null,
  status public.plan_status not null default 'borrador',
  name text not null check (length(btrim(name)) > 0),
  day_type public.day_type not null,
  suggested boolean not null default false,
  kcal integer not null check (kcal > 0),
  protein_g numeric not null check (protein_g >= 0),
  carbs_g numeric not null check (carbs_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  note text not null default '',
  source_template_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menus_tenant_key unique (trainer_id, id),
  constraint menus_client_key unique (id, client_id),
  constraint menus_client_fk foreign key (trainer_id, client_id)
    references public.clients (trainer_id, id) on delete cascade
);

create unique index menus_one_suggested_per_set
  on public.menus (client_id, day_type)
  where status = 'activo' and suggested;

create index menus_client_status_idx on public.menus (client_id, status);

create trigger menus_set_updated_at
  before update on public.menus
  for each row execute function public.set_updated_at();

create table public.meals (
  menu_id uuid not null,
  id uuid not null default gen_random_uuid(),
  trainer_id uuid not null,
  position integer not null check (position >= 0),
  name text not null check (length(btrim(name)) > 0),
  primary key (menu_id, id),
  constraint meals_menu_fk foreign key (trainer_id, menu_id)
    references public.menus (trainer_id, id) on delete cascade
);

-- Food inside a meal. A library item keeps a frozen copy of its name and composition (I29); a free
-- text item has none of them and does not add up (I30). food_id is not a foreign key: a common
-- catalog food lives in food-api (§12), outside this database.
create table public.menu_items (
  menu_id uuid not null,
  meal_id uuid not null,
  id uuid not null default gen_random_uuid(),
  trainer_id uuid not null,
  position integer not null check (position >= 0),
  name text not null check (length(btrim(name)) > 0),
  grams numeric not null check (grams >= 0),
  food_id uuid,
  kcal integer check (kcal >= 0),
  protein_g numeric(4, 1) check (protein_g >= 0),
  carbs_g numeric(4, 1) check (carbs_g >= 0),
  fat_g numeric(4, 1) check (fat_g >= 0),
  primary key (menu_id, id),
  constraint menu_items_meal_fk foreign key (menu_id, meal_id)
    references public.meals (menu_id, id) on delete cascade,
  constraint menu_items_menu_fk foreign key (trainer_id, menu_id)
    references public.menus (trainer_id, id) on delete cascade,
  constraint menu_items_library_check check (
    (food_id is null and kcal is null and protein_g is null and carbs_g is null and fat_g is null)
    or (food_id is not null and kcal is not null and protein_g is not null
        and carbs_g is not null and fat_g is not null)
  ),
  -- Same physical limit as Composicion (§5), applied to the frozen copy.
  constraint menu_items_macros_max check (protein_g + carbs_g + fat_g <= 100)
);

-- Menu template: body is { menus: [...] }, each menu with meals and items and their frozen copies (I29).
create table public.menu_templates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_templates_tenant_key unique (trainer_id, id)
);

create trigger menu_templates_set_updated_at
  before update on public.menu_templates
  for each row execute function public.set_updated_at();

-- Daily macro targets of a client, one per day type while active (I4). Independent of the menus (I4).
create table public.macro_targets (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null,
  day_type public.day_type not null,
  status public.plan_status not null default 'borrador',
  kcal integer not null check (kcal > 0),
  protein_g numeric not null check (protein_g >= 0),
  carbs_g numeric not null check (carbs_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint macro_targets_tenant_key unique (trainer_id, id),
  constraint macro_targets_client_fk foreign key (trainer_id, client_id)
    references public.clients (trainer_id, id) on delete cascade
);

create unique index macro_targets_one_active_per_day
  on public.macro_targets (client_id, day_type)
  where status = 'activo';

create trigger macro_targets_set_updated_at
  before update on public.macro_targets
  for each row execute function public.set_updated_at();

-- Helpers. A routine or menu is writable only as a draft, by its trainer, for a client who is not
-- dado de baja (§7).
create or replace function public.is_writable_routine(routine uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.routines r
    where r.id = routine
      and r.status = 'borrador'
      and public.is_trainer_of(r.trainer_id)
      and public.is_writable_client(r.client_id)
  );
$$;

create or replace function public.is_writable_menu(menu uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.menus m
    where m.id = menu
      and m.status = 'borrador'
      and public.is_trainer_of(m.trainer_id)
      and public.is_writable_client(m.client_id)
  );
$$;

-- Row level security.

alter table public.routines enable row level security;

create policy routines_trainer_select on public.routines
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy routines_trainer_insert on public.routines
  for insert to authenticated
  with check (
    public.is_trainer_of(trainer_id)
    and status = 'borrador'
    and public.is_writable_client(client_id)
  );

create policy routines_trainer_update on public.routines
  for update to authenticated
  using (
    public.is_trainer_of(trainer_id)
    and status = 'borrador'
    and public.is_writable_client(client_id)
  )
  with check (
    public.is_trainer_of(trainer_id)
    and status = 'borrador'
    and public.is_writable_client(client_id)
  );

create policy routines_client_select on public.routines
  for select to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
    and status = 'activo'
  );

alter table public.routine_days enable row level security;

create policy routine_days_select on public.routine_days
  for select to authenticated
  using (exists (select 1 from public.routines r where r.id = routine_days.routine_id));

create policy routine_days_insert on public.routine_days
  for insert to authenticated
  with check (public.is_writable_routine(routine_id));

create policy routine_days_update on public.routine_days
  for update to authenticated
  using (public.is_writable_routine(routine_id))
  with check (public.is_writable_routine(routine_id));

create policy routine_days_delete on public.routine_days
  for delete to authenticated
  using (public.is_writable_routine(routine_id));

alter table public.routine_day_exercises enable row level security;

create policy routine_day_exercises_select on public.routine_day_exercises
  for select to authenticated
  using (exists (select 1 from public.routines r where r.id = routine_day_exercises.routine_id));

create policy routine_day_exercises_insert on public.routine_day_exercises
  for insert to authenticated
  with check (public.is_writable_routine(routine_id));

create policy routine_day_exercises_update on public.routine_day_exercises
  for update to authenticated
  using (public.is_writable_routine(routine_id))
  with check (public.is_writable_routine(routine_id));

create policy routine_day_exercises_delete on public.routine_day_exercises
  for delete to authenticated
  using (public.is_writable_routine(routine_id));

alter table public.routine_templates enable row level security;

create policy routine_templates_trainer_select on public.routine_templates
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy routine_templates_trainer_insert on public.routine_templates
  for insert to authenticated
  with check (public.is_trainer_of(trainer_id));

create policy routine_templates_trainer_update on public.routine_templates
  for update to authenticated
  using (public.is_trainer_of(trainer_id))
  with check (public.is_trainer_of(trainer_id));

create policy routine_templates_trainer_delete on public.routine_templates
  for delete to authenticated
  using (public.is_trainer_of(trainer_id));

alter table public.menus enable row level security;

create policy menus_trainer_select on public.menus
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy menus_trainer_insert on public.menus
  for insert to authenticated
  with check (
    public.is_trainer_of(trainer_id)
    and status = 'borrador'
    and public.is_writable_client(client_id)
  );

create policy menus_trainer_update on public.menus
  for update to authenticated
  using (
    public.is_trainer_of(trainer_id)
    and status = 'borrador'
    and public.is_writable_client(client_id)
  )
  with check (
    public.is_trainer_of(trainer_id)
    and status = 'borrador'
    and public.is_writable_client(client_id)
  );

create policy menus_client_select on public.menus
  for select to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
    and status = 'activo'
  );

alter table public.meals enable row level security;

create policy meals_select on public.meals
  for select to authenticated
  using (exists (select 1 from public.menus m where m.id = meals.menu_id));

create policy meals_insert on public.meals
  for insert to authenticated
  with check (public.is_writable_menu(menu_id));

create policy meals_update on public.meals
  for update to authenticated
  using (public.is_writable_menu(menu_id))
  with check (public.is_writable_menu(menu_id));

create policy meals_delete on public.meals
  for delete to authenticated
  using (public.is_writable_menu(menu_id));

alter table public.menu_items enable row level security;

create policy menu_items_select on public.menu_items
  for select to authenticated
  using (exists (select 1 from public.menus m where m.id = menu_items.menu_id));

create policy menu_items_insert on public.menu_items
  for insert to authenticated
  with check (public.is_writable_menu(menu_id));

create policy menu_items_update on public.menu_items
  for update to authenticated
  using (public.is_writable_menu(menu_id))
  with check (public.is_writable_menu(menu_id));

create policy menu_items_delete on public.menu_items
  for delete to authenticated
  using (public.is_writable_menu(menu_id));

alter table public.menu_templates enable row level security;

create policy menu_templates_trainer_select on public.menu_templates
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy menu_templates_trainer_insert on public.menu_templates
  for insert to authenticated
  with check (public.is_trainer_of(trainer_id));

create policy menu_templates_trainer_update on public.menu_templates
  for update to authenticated
  using (public.is_trainer_of(trainer_id))
  with check (public.is_trainer_of(trainer_id));

create policy menu_templates_trainer_delete on public.menu_templates
  for delete to authenticated
  using (public.is_trainer_of(trainer_id));

-- Macro targets are written only by RPC (Fase 5): setting them archives the previous ones and
-- activates the new ones in one step. Policies below are read only.
alter table public.macro_targets enable row level security;

create policy macro_targets_trainer_select on public.macro_targets
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

-- I11: the client reads the targets only while macrosVisible is not false in their ficha.
create policy macro_targets_client_select on public.macro_targets
  for select to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
    and status = 'activo'
    and exists (
      select 1
      from public.clients c
      where c.id = macro_targets.client_id
        and c.macros_visible
    )
  );
