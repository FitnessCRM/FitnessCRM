-- The access token hook runs as supabase_auth_admin, and RLS applies to it. Without a policy for that
-- role the hook reads no profile, so tokens are issued without user_role, trainer_id or client_id, and
-- every RLS check that reads those claims returns nothing.
create policy profiles_auth_hook_read on public.profiles
  as permissive for select to supabase_auth_admin
  using (true);

-- Supabase grants anon and authenticated every privilege on public tables by default. RLS does not
-- govern TRUNCATE, and the API never needs it, so take it away from the existing tables and from the
-- ones created later.
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
