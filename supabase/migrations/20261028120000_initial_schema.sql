-- Initial schema: tenancy root, profiles (role claims), clients and exercise library.
-- Source of truth: docs/dominio.md §4 (agregados), §6 (invariantes), §7 (ciclos de vida),
-- and lib/domain/schemas. Every aggregate carries trainer_id (multi-tenant, §4).

create type public.app_role as enum ('trainer', 'client', 'admin');
create type public.client_status as enum ('invitado', 'activo', 'dado_de_baja');
create type public.exercise_status as enum ('activo', 'archivado');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trainer: tenancy root (§4). Its id is the auth user id of the trainer.
create table public.trainers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  email text not null,
  time_zone text not null check (length(btrim(time_zone)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trainers_set_updated_at
  before update on public.trainers
  for each row execute function public.set_updated_at();

-- Profile: links an auth user to a role and, for trainers and clients, to a tenant.
-- Read by the Custom Access Token Hook (20261028120100_access_token_hook.sql).
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  trainer_id uuid references public.trainers (id) on delete cascade,
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_scope check (
    (role = 'admin' and trainer_id is null and client_id is null)
    or (role = 'trainer' and trainer_id is not null and client_id is null)
    or (role = 'client' and trainer_id is not null and client_id is not null)
  )
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index profiles_trainer_id_idx on public.profiles (trainer_id);

-- Client (§4, §7). Composite key (trainer_id, id) lets child tables prove same-tenant
-- references with a foreign key instead of application code (I2, I3).
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  first_name text not null check (length(btrim(first_name)) > 0),
  last_name text not null check (length(btrim(last_name)) > 0),
  email text not null check (length(btrim(email)) > 0),
  phone text not null default '',
  goal text not null default '',
  level text not null default '',
  initial_notes text not null default '',
  status public.client_status not null default 'invitado',
  start_date date not null,
  review_every_days integer not null check (review_every_days > 0),
  macros_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_tenant_key unique (trainer_id, id)
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create index clients_trainer_status_idx on public.clients (trainer_id, status);

-- A client profile must point at a client of the same trainer: the composite key makes
-- that a database guarantee (I2). Null client_id (trainer and admin profiles) skips the check.
alter table public.profiles
  add constraint profiles_client_fk
  foreign key (trainer_id, client_id) references public.clients (trainer_id, id) on delete cascade;

-- Exercise library (I3, I13). Archiving keeps the row; deleting is not allowed by design.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  muscle_group text not null default '',
  equipment text not null default '',
  video_url text check (video_url ~* '^https?://\S+$'),
  description text not null default '',
  status public.exercise_status not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_tenant_key unique (trainer_id, id)
);

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

create index exercises_trainer_status_idx on public.exercises (trainer_id, status);
