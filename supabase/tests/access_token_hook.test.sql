begin;

select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'other@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador', 'trainer@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Otro', 'other@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'Test', 'marta@test.local', '2026-01-05', 7),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Ajena', 'Test', 'ajena@test.local', '2026-01-05', 7);

insert into public.profiles (user_id, role, trainer_id) values
  ('11111111-1111-1111-1111-111111111111', 'trainer', '11111111-1111-1111-1111-111111111111');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '11111111-1111-1111-1111-111111111111',
    'claims', '{"role": "authenticated"}'::jsonb
  )) -> 'claims' ->> 'user_role',
  'trainer',
  'trainer token carries user_role'
);

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '11111111-1111-1111-1111-111111111111',
    'claims', '{"role": "authenticated"}'::jsonb
  )) -> 'claims' ->> 'trainer_id',
  '11111111-1111-1111-1111-111111111111',
  'trainer token carries trainer_id'
);

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '11111111-1111-1111-1111-111111111111',
    'claims', '{"role": "authenticated"}'::jsonb
  )) -> 'claims' ->> 'role',
  'authenticated',
  'top-level role claim is left untouched for PostgREST'
);

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '22222222-2222-2222-2222-222222222222',
    'claims', '{"role": "authenticated"}'::jsonb
  )) -> 'claims' ->> 'user_role',
  'client',
  'client token carries user_role'
);

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '22222222-2222-2222-2222-222222222222',
    'claims', '{"role": "authenticated"}'::jsonb
  )) -> 'claims' ->> 'client_id',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'client token carries client_id'
);

select throws_ok(
  $$insert into public.profiles (user_id, role, trainer_id, client_id) values
      ('33333333-3333-3333-3333-333333333333', 'client', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  '23503',
  null,
  'a client profile cannot point at another trainer''s client'
);

select * from finish();

rollback;
