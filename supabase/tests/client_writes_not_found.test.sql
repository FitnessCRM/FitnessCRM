begin;

select plan(6);

-- Fixtures: trainer A with an active client and one who has left (dado de baja); trainer B with a client
-- of its own. Trainer A must get `client.not_found` for B's client and for an id that does not exist, and
-- `client.not_writable` for its own client who has left.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Luis', 'A', 'luis@test.local', '2026-01-05', 7, 'dado_de_baja'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Ajena', 'B', 'ajena@test.local', '2026-01-05', 7, 'activo');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$select public.create_routine_draft('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"name":"Nueva","note":"","days":[]}'::jsonb)$$,
  'P0001',
  'client.not_found',
  'create_routine_draft: a client of another trainer is not found'
);

select throws_ok(
  $$select public.create_routine_draft('dddddddd-dddd-dddd-dddd-dddddddddddd', '{"name":"Nueva","note":"","days":[]}'::jsonb)$$,
  'P0001',
  'client.not_found',
  'create_routine_draft: a client that does not exist is not found'
);

select throws_ok(
  $$select public.create_routine_draft('cccccccc-cccc-cccc-cccc-cccccccccccc', '{"name":"Nueva","note":"","days":[]}'::jsonb)$$,
  'P0001',
  'client.not_writable',
  'create_routine_draft: a client of this trainer who has left is not writable, not not-found'
);

select throws_ok(
  $$select public.create_menu_draft('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{}'::jsonb)$$,
  'P0001',
  'client.not_found',
  'create_menu_draft: a client of another trainer is not found'
);

select throws_ok(
  $$select public.set_macro_targets('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'entrenamiento', 2000, 150, 200, 60)$$,
  'P0001',
  'client.not_found',
  'set_macro_targets: a client of another trainer is not found'
);

select throws_ok(
  $$select public.set_macros_visible('dddddddd-dddd-dddd-dddd-dddddddddddd', false)$$,
  'P0001',
  'client.not_found',
  'set_macros_visible: a client that does not exist is not found'
);

select * from finish();

rollback;
