begin;

select plan(10);

-- Card 125: the confirmed payment creates the membership once (E6, I34, S10), starting after the one
-- in force (E4), with the frozen price and the payment id (E2, I21).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.trainer_payment_accounts (trainer_id, stripe_account_id, charges_enabled) values
  ('11111111-1111-1111-1111-111111111111', 'acct_test_a', true);

-- In force on the payment day (2026-11-03 in Madrid): ends on 2026-12-31.
insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trimestral', '2026-10-01', '2026-12-31', 'pagada');

set local role service_role;

select set_config('test.first',
  public.record_online_payment('pi_test_1', 'acct_test_a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', 4900, '2026-11-03T10:00:00Z')::text,
  true);
select set_config('test.second',
  public.record_online_payment('pi_test_1', 'acct_test_a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', 4900, '2026-11-03T10:00:00Z')::text,
  true);

reset role;

select is(current_setting('test.second'), current_setting('test.first'), 'the same payment twice returns the same membership (S10)');
select is((select count(*)::int from public.memberships where online_payment_id = 'pi_test_1'), 1, 'and creates only one (I34)');

select is(
  (select row(start_date, end_date, payment_status::text, price_cents)::text from public.memberships where online_payment_id = 'pi_test_1'),
  row('2027-01-01'::date, '2027-01-31'::date, 'pagada', 4900)::text,
  'it starts the day after the one in force, already paid, with the price charged (E4, E2)'
);

set local role service_role;

select throws_ok(
  $$select public.record_online_payment('pi_test_2', 'acct_other', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', 4900, now())$$,
  'P0001',
  'payment.account_mismatch',
  'a payment from another connected account does not create a membership'
);

select set_config('test.alone',
  public.record_online_payment('pi_test_3', 'acct_test_a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'anual', 44900, '2027-03-15T23:30:00Z')::text,
  true);

reset role;

select is(
  (select row(start_date, end_date)::text from public.memberships where online_payment_id = 'pi_test_3'),
  row('2027-03-16'::date, '2028-03-15'::date)::text,
  'with none in force it starts on the payment day, in the trainer zone (E4)'
);

-- Nobody signed in records a payment or reads the connected account.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$select public.record_online_payment('pi_x', 'acct_test_a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', 1, now())$$,
  '42501',
  null,
  'only the webhook records a payment: a trainer cannot (E6)'
);

select is((select count(*)::int from public.trainer_payment_accounts), 0, 'the connected account is not readable through the API');

select is(
  (select row(connected, enabled)::text from public.online_payment_status('11111111-1111-1111-1111-111111111111')),
  row(true, true)::text,
  'the trainer knows their online payments are enabled'
);

set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is(
  (select enabled from public.online_payment_status('11111111-1111-1111-1111-111111111111')),
  true,
  'so does their active client (E5)'
);

reset role;
update public.clients set status = 'dado_de_baja' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is(
  (select enabled from public.online_payment_status('11111111-1111-1111-1111-111111111111')),
  false,
  'a discharged client cannot pay (E5)'
);

select * from finish();
rollback;
