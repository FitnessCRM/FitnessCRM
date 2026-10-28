begin;

select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'admin@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'Luis', 'A', 'luis@test.local', '2026-01-05', 7, 'dado_de_baja');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Membership: the end date cannot come before the start date.
select throws_ok(
  $$insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', '2026-02-28', '2026-02-01', 'pagada')$$,
  '23514',
  null,
  'a membership cannot end before it starts'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', '2026-02-01', '2026-02-28', 'pagada')$$,
  'the trainer records a membership for an active client'
);

select throws_ok(
  $$insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'mensual', '2026-02-01', '2026-02-28', 'no_pagada')$$,
  '42501',
  null,
  'the trainer cannot record a membership for a client dado de baja (§7)'
);

set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*)::int from public.memberships), 1, 'a client reads their own memberships');

set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select is((select count(*)::int from public.memberships), 0, 'trainer B reads no membership of trainer A');

-- Trainer invitations: the platform administration invites, and the invitee reads their own.
set local "request.jwt.claims" to '{"sub":"44444444-4444-4444-4444-444444444444","user_role":"admin"}';

select lives_ok(
  $$insert into public.trainer_invitations (email, name, time_zone) values
      ('ana@test.local', 'Ana', 'Europe/Madrid')$$,
  'the administration invites a trainer with a pending invitation'
);

select throws_ok(
  $$insert into public.trainer_invitations (email, name, time_zone, status, trainer_id, accepted_at) values
      ('otra@test.local', 'Otra', 'Europe/Madrid', 'aceptada', '11111111-1111-1111-1111-111111111111', now())$$,
  '42501',
  null,
  'the administration cannot insert an invitation already accepted'
);

reset role;

select throws_ok(
  $$insert into public.trainer_invitations (email, name, time_zone) values
      ('Ana@Test.local', 'Ana', 'Europe/Madrid')$$,
  '23514',
  null,
  'an invitation email is stored in lower case'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select is((select count(*)::int from public.trainer_invitations), 0, 'a trainer who is not the invitee reads no invitation');

set local "request.jwt.claims" to '{"sub":"66666666-6666-6666-6666-666666666666","email":"ana@test.local"}';

select is((select count(*)::int from public.trainer_invitations), 1, 'the invitee reads their own invitation by email');

set local "request.jwt.claims" to '{"sub":"44444444-4444-4444-4444-444444444444","user_role":"admin"}';

delete from public.trainer_invitations where email = 'ana@test.local';

reset role;

select is(
  (select count(*)::int from public.trainer_invitations where email = 'ana@test.local'),
  0,
  'the administration withdraws a pending invitation'
);

select * from finish();

rollback;
