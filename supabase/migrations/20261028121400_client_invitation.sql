-- Client invitation acceptance (Fase 6, §7 and §12).
-- The invitation link verifies the email, so the client's first session exists here: this creates
-- the client's profile and moves the client from invitado to activo, in one transaction. The caller
-- is the new account; the client must be invitado, and its email must be the verified one.

create or replace function public.accept_client_invitation(p_client_id uuid)
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

  update public.clients set status = 'activo' where id = v_client.id;

  return v_client.id;
end;
$$;

revoke execute on function public.accept_client_invitation(uuid) from public, anon;
grant execute on function public.accept_client_invitation(uuid) to authenticated;
