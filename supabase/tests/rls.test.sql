begin;

select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'admin@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, goal) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'original'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'Luis', 'A', 'luis@test.local', '2026-01-05', 7, ''),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Ajena', 'B', 'ajena@test.local', '2026-01-05', 7, '');

insert into public.exercises (id, trainer_id, name) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Sentadilla');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.profiles (user_id, role) values
  ('44444444-4444-4444-4444-444444444444', 'admin');

-- Trainer A: own clients and own exercises only.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select is((select count(*)::int from public.clients), 2, 'trainer A sees their two clients');

select is((select count(*)::int from public.clients where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'trainer A does not see trainer B client');

select is((select count(*)::int from public.exercises), 1, 'trainer A sees their exercise');

select throws_ok(
  $$insert into public.clients (trainer_id, first_name, last_name, email, start_date, review_every_days)
    values ('33333333-3333-3333-3333-333333333333', 'Intrusa', 'A', 'x@test.local', '2026-01-05', 7)$$,
  '42501',
  null,
  'trainer A cannot insert a client into trainer B tenant'
);

-- Client: own row only, and no write through the API.
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*)::int from public.clients), 1, 'client sees only their own row');

update public.clients set goal = 'hacked' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

reset role;

select is((select goal from public.clients where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'original', 'client update is rejected by RLS');

-- Anonymous: nothing.
set local role anon;
select is((select count(*)::int from public.clients), 0, 'anon sees no clients');

-- Admin: trainers yes, clients no.
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"44444444-4444-4444-4444-444444444444","user_role":"admin"}';

select is((select count(*)::int from public.trainers), 2, 'admin reads all trainers');

select is((select count(*)::int from public.clients), 0, 'admin does not read clients');

select * from finish();

rollback;
