begin;

select plan(8);

-- E1, E3: rates per trainer and type; I21: the payment columns are not writable through the API.
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

insert into public.membership_rates (trainer_id, type, active, price_cents) values
  ('33333333-3333-3333-3333-333333333333', 'mensual', true, 3900);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$insert into public.membership_rates (trainer_id, type, active, price_cents) values
    ('11111111-1111-1111-1111-111111111111', 'mensual', true, 4900),
    ('11111111-1111-1111-1111-111111111111', 'trimestral', false, 12900),
    ('11111111-1111-1111-1111-111111111111', 'anual', true, null)$$,
  'the trainer sets their rates'
);

select throws_ok(
  $$insert into public.membership_rates (trainer_id, type, active, price_cents) values
    ('11111111-1111-1111-1111-111111111111', 'semestral', true, 0)$$,
  '23514',
  null,
  'a price is greater than zero (E3)'
);

select is((select count(*)::int from public.membership_rates), 3, 'a trainer reads only their own rates');

-- Card 127: manual registration writes the price charged, but never the id of a payment.
select throws_ok(
  $$insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status, online_payment_id)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', '2026-11-01', '2026-11-30', 'pagada', 'cs_test_manual')$$,
  'P0001',
  'membership.payment_readonly',
  'manual registration cannot write a payment id: only a confirmed payment does (I21, I34)'
);

select lives_ok(
  $$insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'semestral', '2026-11-01', '2027-04-30', 'pagada')$$,
  'manual registration still accepts any type, with or without rate (S6, E1)'
);

-- The client sees only the payable rates of their trainer.
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is(
  (select array_agg(type::text order by type) from public.membership_rates),
  array['mensual'],
  'a client reads only the active rates with price of their trainer (E1)'
);

select lives_ok(
  $$update public.membership_rates set price_cents = 1 where type = 'mensual'$$,
  'a client update on a rate is filtered out by RLS'
);

reset role;

select is(
  (select price_cents from public.membership_rates
    where trainer_id = '11111111-1111-1111-1111-111111111111' and type = 'mensual'),
  4900,
  'and the rate stays as it was'
);

select * from finish();
rollback;
