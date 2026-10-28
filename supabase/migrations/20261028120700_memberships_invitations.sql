-- Memberships and trainer invitations (Fase 2 and 3).
-- Source of truth: docs/dominio.md §6 (I21), §7 (Membresía), §12 (alta de un entrenador: invitación
-- de la administración) and lib/domain/schemas/membership.ts.
--
-- Client invitations need no table: they are Supabase Auth invites, and their state is the client's
-- status (invitado → activo, §7). Accepting a trainer invitation creates the trainer and the profile
-- in one step, so it goes through an RPC (Fase 5); the policies here only let the admin invite and
-- the invitee read.

create type public.membership_type as enum ('mensual', 'trimestral', 'semestral', 'anual');
create type public.payment_status as enum ('pagada', 'no_pagada');
create type public.trainer_invitation_status as enum ('invitado', 'aceptada');

-- Membership: contracted period and its payment status (I21). Renewals are new rows (§7).
-- Overlapping periods are allowed: the domain reports them, it does not forbid them.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null,
  type public.membership_type not null,
  start_date date not null,
  end_date date not null,
  payment_status public.payment_status not null,
  created_at timestamptz not null default now(),
  constraint memberships_tenant_key unique (trainer_id, id),
  constraint memberships_client_fk foreign key (trainer_id, client_id)
    references public.clients (trainer_id, id) on delete cascade,
  constraint memberships_dates_check check (end_date >= start_date)
);

create index memberships_client_start_idx on public.memberships (client_id, start_date desc);

-- Trainer invitation (§12). Written by the platform administration, read by it and by the invitee.
-- The email is the key and is stored in lower case.
create table public.trainer_invitations (
  email text primary key,
  name text not null check (length(btrim(name)) > 0),
  time_zone text not null check (length(btrim(time_zone)) > 0),
  status public.trainer_invitation_status not null default 'invitado',
  trainer_id uuid references public.trainers (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint trainer_invitations_email_check check (email = lower(btrim(email)) and length(email) > 0),
  constraint trainer_invitations_status_check check (
    (status = 'invitado' and trainer_id is null and accepted_at is null)
    or (status = 'aceptada' and trainer_id is not null and accepted_at is not null)
  )
);

-- Row level security.

alter table public.memberships enable row level security;

create policy memberships_trainer_select on public.memberships
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy memberships_trainer_insert on public.memberships
  for insert to authenticated
  with check (
    public.is_trainer_of(trainer_id)
    and public.is_writable_client(client_id)
  );

create policy memberships_trainer_update on public.memberships
  for update to authenticated
  using (
    public.is_trainer_of(trainer_id)
    and public.is_writable_client(client_id)
  )
  with check (
    public.is_trainer_of(trainer_id)
    and public.is_writable_client(client_id)
  );

create policy memberships_client_select on public.memberships
  for select to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
  );

alter table public.trainer_invitations enable row level security;

create policy trainer_invitations_admin_select on public.trainer_invitations
  for select to authenticated
  using ((select public.current_user_role()) = 'admin');

create policy trainer_invitations_admin_insert on public.trainer_invitations
  for insert to authenticated
  with check (
    (select public.current_user_role()) = 'admin'
    and status = 'invitado'
  );

-- The administration withdraws only a pending invitation (§12).
create policy trainer_invitations_admin_delete on public.trainer_invitations
  for delete to authenticated
  using (
    (select public.current_user_role()) = 'admin'
    and status = 'invitado'
  );

create policy trainer_invitations_invitee_select on public.trainer_invitations
  for select to authenticated
  using (email = lower((select auth.jwt() ->> 'email')));
