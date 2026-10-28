-- Custom Access Token Hook (Fase 1.4). Adds the app role and tenant to the JWT.
--
-- The claim is named `user_role`, not `role`: Supabase already uses the top-level `role`
-- claim ("authenticated") for PostgREST, and overwriting it would break every request.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  profile public.profiles%rowtype;
begin
  select * into profile
  from public.profiles
  where user_id = (event ->> 'user_id')::uuid;

  if found then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(profile.role::text));

    if profile.trainer_id is not null then
      claims := jsonb_set(claims, '{trainer_id}', to_jsonb(profile.trainer_id::text));
    end if;

    if profile.client_id is not null then
      claims := jsonb_set(claims, '{client_id}', to_jsonb(profile.client_id::text));
    end if;
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Only the Auth service may run the hook; end users never call it.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.profiles to supabase_auth_admin;
