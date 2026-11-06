begin;

select plan(5);

-- I31 (E10): one client per email across the platform; the email only changes while invited.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'Luis', 'A', 'luis@test.local', '2026-01-05', 7, 'invitado');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select throws_ok(
  $$insert into public.clients (trainer_id, first_name, last_name, email, start_date, review_every_days)
    values ('33333333-3333-3333-3333-333333333333', 'Otra', 'B', ' MARTA@test.local', '2026-01-05', 7)$$,
  '23505',
  null,
  'another trainer cannot create a client with an email already in use, whatever the case (I31)'
);

set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$update public.clients set email = 'luis.nuevo@test.local' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab'$$,
  'the email of an invited client can change'
);

select throws_ok(
  $$update public.clients set email = 'marta.nueva@test.local' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'P0001',
  'client.email_locked',
  'the email of an active client does not change (I31)'
);

select lives_ok(
  $$update public.clients set email = 'MARTA@test.local', goal = 'x' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'rewriting the same email with other case is not a change'
);

select throws_ok(
  $$update public.clients set email = 'marta@test.local' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab'$$,
  '23505',
  null,
  'an invited client cannot take an email already in use (I31)'
);

select * from finish();
rollback;
