begin;

select plan(3);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_auth_hook_read'
      and roles @> array['supabase_auth_admin']::name[]
  ),
  'the auth hook role has a read policy on profiles'
);

select ok(
  has_table_privilege('supabase_auth_admin', 'public.profiles', 'SELECT'),
  'the auth hook role can select profiles, so the policy above applies to it'
);

select is(
  (select count(*)
   from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon', 'authenticated')
     and privilege_type = 'TRUNCATE'),
  0::bigint,
  'anon and authenticated hold no TRUNCATE on public tables'
);

select * from finish();

rollback;
