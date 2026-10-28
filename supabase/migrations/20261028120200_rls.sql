-- Row level security for the core tables (Fase 3). Claims come from the access token hook:
-- user_role, trainer_id and client_id (20261028120100_access_token_hook.sql).
--
-- Writes that touch more than one row or change a client's own data go through RPCs
-- (Fase 5). Here: a trainer manages their own tenant, a client reads their own row, and
-- admin reads only the trainers table.

create or replace function public.current_user_role()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'user_role', '');
$$;

create or replace function public.current_trainer_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'trainer_id', '')::uuid;
$$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'client_id', '')::uuid;
$$;

-- Helpers for the policies of the later migrations: each rule lives in one place.

-- The caller is a trainer and the row belongs to that trainer's tenant.
create or replace function public.is_trainer_of(tenant uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select public.current_user_role()) = 'trainer'
    and tenant = (select public.current_trainer_id());
$$;

-- The caller is a client whose ficha is active. A client dado de baja has no access (§7, §12).
create or replace function public.is_active_client()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select public.current_user_role()) = 'client'
    and exists (
      select 1
      from public.clients c
      where c.id = (select public.current_client_id())
        and c.trainer_id = (select public.current_trainer_id())
        and c.status = 'activo'
    );
$$;

-- The caller is the trainer of this client and the client is not dado de baja. A trainer
-- can still write for a client who is invitado (§7).
create or replace function public.is_writable_client(client uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select public.current_user_role()) = 'trainer'
    and exists (
      select 1
      from public.clients c
      where c.id = client
        and c.trainer_id = (select public.current_trainer_id())
        and c.status <> 'dado_de_baja'
    );
$$;

alter table public.trainers enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.exercises enable row level security;

-- Trainers: a trainer and the clients of that trainer read their trainer row; admin reads all.
create policy trainers_select_tenant on public.trainers
  for select to authenticated
  using (
    id = (select public.current_trainer_id())
    or (select public.current_user_role()) = 'admin'
  );

create policy trainers_update_own on public.trainers
  for update to authenticated
  using (id = (select public.current_trainer_id()) and (select public.current_user_role()) = 'trainer')
  with check (id = (select public.current_trainer_id()) and (select public.current_user_role()) = 'trainer');

-- Profiles: each user reads their own profile. Nobody writes profiles through the API;
-- they are created by the auth flow and by the admin, outside RLS (service role).
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Clients: the trainer manages their clients; a client reads their own row only.
-- Clients never update through the API: macros_visible goes through an RPC (Fase 5).
create policy clients_trainer_select on public.clients
  for select to authenticated
  using (
    trainer_id = (select public.current_trainer_id())
    and (select public.current_user_role()) = 'trainer'
  );

create policy clients_client_select on public.clients
  for select to authenticated
  using (
    id = (select public.current_client_id())
    and (select public.current_user_role()) = 'client'
  );

create policy clients_trainer_insert on public.clients
  for insert to authenticated
  with check (
    trainer_id = (select public.current_trainer_id())
    and (select public.current_user_role()) = 'trainer'
  );

create policy clients_trainer_update on public.clients
  for update to authenticated
  using (
    trainer_id = (select public.current_trainer_id())
    and (select public.current_user_role()) = 'trainer'
  )
  with check (
    trainer_id = (select public.current_trainer_id())
    and (select public.current_user_role()) = 'trainer'
  );

-- No delete policy on clients: a client is discharged (dado_de_baja), never deleted through the
-- API. The explicit per-client erasure is an RPC (§7, Fase 5).

-- Exercises: only the trainer who owns them. Clients reach exercises through their routines
-- (exercises_client_select, 20261028120600). No delete policy: exercises are archived (I13).
create policy exercises_trainer_select on public.exercises
  for select to authenticated
  using (
    trainer_id = (select public.current_trainer_id())
    and (select public.current_user_role()) = 'trainer'
  );

create policy exercises_trainer_insert on public.exercises
  for insert to authenticated
  with check (
    trainer_id = (select public.current_trainer_id())
    and (select public.current_user_role()) = 'trainer'
  );

create policy exercises_trainer_update on public.exercises
  for update to authenticated
  using (
    trainer_id = (select public.current_trainer_id())
    and (select public.current_user_role()) = 'trainer'
  )
  with check (
    trainer_id = (select public.current_trainer_id())
    and (select public.current_user_role()) = 'trainer'
  );
