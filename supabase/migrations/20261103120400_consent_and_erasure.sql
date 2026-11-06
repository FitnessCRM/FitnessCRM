-- Card 31 (docs/dominio.md §6, §7 and §9, 03-11-2026).
--
-- C1 (I33): the client accepts the consent text when accepting the invitation; the version and the
-- date are stored and nobody rewrites them. The text and its current version live in the app
-- (CONSENT_VERSION); the database requires one and records it. Clients from before have none.
--
-- E11 (I14): erasure on request of a discharged client, without anonymising. The erase-client Edge
-- Function deletes the photos from Storage first (client_erasure_paths says which), then
-- erase_client checks none is left, deletes every row of the client and returns the accounts that
-- the function deletes from Auth last. Each step can be repeated if one fails.

alter table public.clients
  add column consent_version text,
  add column consent_accepted_at timestamptz,
  add constraint clients_consent_check check (
    (consent_version is null) = (consent_accepted_at is null)
    and (consent_version is null or length(btrim(consent_version)) > 0)
  );

-- Only the acceptance function writes the consent: not the trainer, not the client through the API.
create or replace function public.protect_client_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and (
    (tg_op = 'INSERT' and (new.consent_version is not null or new.consent_accepted_at is not null))
    or (tg_op = 'UPDATE' and (
      new.consent_version is distinct from old.consent_version
      or new.consent_accepted_at is distinct from old.consent_accepted_at
    ))
  ) then
    raise exception 'client.consent_readonly';
  end if;
  return new;
end;
$$;

create trigger clients_protect_consent
  before insert or update on public.clients
  for each row execute function public.protect_client_consent();

-- Acceptance now requires the consent version (I33). Same checks as before.
drop function public.accept_client_invitation(uuid);

create function public.accept_client_invitation(p_client_id uuid, p_consent_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_client public.clients;
begin
  if v_user is null or v_email = '' then
    raise exception 'invitation.not_found';
  end if;
  if coalesce(btrim(p_consent_version), '') = '' then
    raise exception 'invitation.consent_required';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null) then
    raise exception 'invitation.email_not_verified';
  end if;

  select * into v_client from public.clients c
    where c.id = p_client_id and c.status = 'invitado' and lower(c.email) = v_email
    for update;
  if not found then
    raise exception 'invitation.not_found';
  end if;
  if exists (select 1 from public.profiles p where p.user_id = v_user) then
    raise exception 'invitation.already_registered';
  end if;

  insert into public.profiles (user_id, role, trainer_id, client_id)
    values (v_user, 'client', v_client.trainer_id, v_client.id);

  update public.clients
    set status = 'activo', consent_version = btrim(p_consent_version), consent_accepted_at = now()
    where id = v_client.id;

  return v_client.id;
end;
$$;

revoke execute on function public.accept_client_invitation(uuid, text) from public, anon;
grant execute on function public.accept_client_invitation(uuid, text) to authenticated;

-- The client of the caller that can be erased: their own, and discharged. Raises otherwise.
create or replace function public.erasable_client(p_client_id uuid)
returns public.clients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
begin
  select * into v_client from public.clients where id = p_client_id;
  if not found or not public.is_trainer_of(v_client.trainer_id) then
    raise exception 'client.not_found';
  end if;
  if v_client.status <> 'dado_de_baja' then
    raise exception 'client.not_discharged';
  end if;
  return v_client;
end;
$$;

-- Every photo object of the client: the registered ones and whatever is left under its folder.
create or replace function public.client_erasure_paths(p_client_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients := public.erasable_client(p_client_id);
begin
  return array(
    select name from storage.objects
      where bucket_id = 'review-photos'
        and name like v_client.trainer_id::text || '/' || v_client.id::text || '/%'
    union
    select m.storage_path from public.review_media m
      join public.reviews r on r.id = m.review_id
      where r.client_id = v_client.id
  );
end;
$$;

-- Deletes the client and everything that hangs from them, once no photo is left in Storage.
-- Reviews go first, so I25 does not stop the weight logs (reviews_logs.sql). Returns the Auth
-- accounts of the client, for the Edge Function to delete.
create or replace function public.erase_client(p_client_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients := public.erasable_client(p_client_id);
  v_accounts uuid[];
begin
  if exists (
    select 1 from storage.objects
      where bucket_id = 'review-photos'
        and name like v_client.trainer_id::text || '/' || v_client.id::text || '/%'
  ) then
    raise exception 'client.photos_remaining';
  end if;

  select coalesce(array_agg(user_id), '{}') into v_accounts
    from public.profiles where client_id = v_client.id;

  delete from public.reviews where client_id = v_client.id;
  delete from public.clients where id = v_client.id; -- cascades to plans, logs, memberships, profiles

  return v_accounts;
end;
$$;

revoke all on function public.erasable_client(uuid) from public, anon, authenticated;
revoke execute on function public.client_erasure_paths(uuid) from public, anon;
revoke execute on function public.erase_client(uuid) from public, anon;
grant execute on function public.client_erasure_paths(uuid) to authenticated;
grant execute on function public.erase_client(uuid) to authenticated;
