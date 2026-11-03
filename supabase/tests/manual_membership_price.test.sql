begin;

select plan(7);

-- Card 127: the price charged in a manual registration (E2, E3, S6), frozen once written.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$insert into public.memberships (id, trainer_id, client_id, type, start_date, end_date, payment_status, price_cents)
    values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', '2026-11-01', '2026-11-30', 'pagada', 4500)$$,
  'the trainer writes the price charged in a manual registration'
);

select lives_ok(
  $$insert into public.memberships (id, trainer_id, client_id, type, start_date, end_date, payment_status)
    values ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trimestral', '2026-12-01', '2027-02-28', 'no_pagada')$$,
  'and can save it without a price'
);

select is(
  (select array_agg(price_cents order by start_date) from public.memberships),
  array[4500, null]::integer[],
  'the price is stored in whole cents, or null'
);

select throws_ok(
  $$insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status, price_cents)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', '2027-03-01', '2027-03-31', 'pagada', 0)$$,
  '23514',
  null,
  'a price is greater than zero (E3)'
);

select throws_ok(
  $$update public.memberships set price_cents = 9900 where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'P0001',
  'membership.payment_readonly',
  'the frozen copy is not changed afterwards (E2)'
);

select throws_ok(
  $$update public.memberships set price_cents = 9900 where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  'P0001',
  'membership.payment_readonly',
  'nor added to a membership saved without price'
);

-- Another trainer cannot register one for this client, with or without price.
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select throws_ok(
  $$insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status, price_cents)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', '2027-04-01', '2027-04-30', 'pagada', 4500)$$,
  '42501',
  null,
  'RLS keeps other trainers out (I1)'
);

reset role;

select * from finish();
rollback;
