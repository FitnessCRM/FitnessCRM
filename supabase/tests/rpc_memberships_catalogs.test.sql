begin;

select plan(13);

-- Fixtures: two trainers, a client of each, a food, a measurement type and a question of trainer A,
-- and a food of trainer B that trainer A must not archive.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Ajena', 'B', 'ajena@test.local', '2026-01-05', 7, 'activo');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.foods (id, trainer_id, name, kcal, protein_g, carbs_g, fat_g) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Avena', 370, 13.0, 60.0, 7.0),
  ('f0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Pollo', 110, 23.0, 0.0, 2.0);

insert into public.measurement_types (id, trainer_id, label, unit, sort_order) values
  ('3e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cintura', 'cm', 0);

insert into public.questionnaire_questions (id, trainer_id, prompt, format_kind, scale_min, scale_max, sort_order) values
  ('4e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sueno', 'escala', 0, 10, 0);

-- Memberships: a renewal is a new row with the end of its period (§7, I21). The day of the month is
-- clamped when the target month is shorter, as membershipEndDate does.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select set_config(
  'test.quarter',
  public.renew_membership('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'trimestral', '2026-01-31', 'pagada')::text,
  true
);

select set_config(
  'test.month',
  public.renew_membership('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', '2026-02-01', 'no_pagada')::text,
  true
);

reset role;

select is(
  (select end_date::text from public.memberships where id = current_setting('test.quarter')::uuid),
  '2026-04-29',
  'a quarterly renewal from 31 January ends 29 April, the day before the clamped 30 April'
);

select is(
  (select end_date::text from public.memberships where id = current_setting('test.month')::uuid),
  '2026-02-28',
  'a monthly renewal from 1 February ends 28 February'
);

select is(
  (select count(*)::int from public.memberships where client_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'each renewal is a new row, and the history keeps both'
);

-- Only the trainer of the client renews (I21, §12).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select throws_ok(
  $$select public.renew_membership('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', '2026-03-01', 'pagada')$$,
  'P0001',
  'client.not_writable',
  'a client cannot renew their own membership'
);

set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$select public.renew_membership('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'mensual', '2026-03-01', 'pagada')$$,
  'P0001',
  'client.not_writable',
  'a trainer cannot renew a membership of another trainer client'
);

-- Catalogs: archived, never deleted (I13). A trainer archives only their own entries.
select lives_ok(
  $$select public.archive_food('f0000000-0000-0000-0000-000000000001')$$,
  'a trainer archives their own food'
);

reset role;

select is(
  (select status::text from public.foods where id = 'f0000000-0000-0000-0000-000000000001'),
  'archivado',
  'the food is archived, not deleted'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$select public.archive_food('f0000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'food.not_found',
  'a trainer cannot archive a food of another trainer'
);

select lives_ok(
  $$select public.archive_measurement_type('3e000000-0000-0000-0000-000000000001')$$,
  'a trainer archives a measurement type'
);

select lives_ok(
  $$select public.archive_question('4e000000-0000-0000-0000-000000000001')$$,
  'a trainer archives a question'
);

reset role;

select is(
  (select status::text from public.measurement_types where id = '3e000000-0000-0000-0000-000000000001'),
  'archivada',
  'the measurement type is archived, not deleted'
);

select is(
  (select status::text from public.questionnaire_questions where id = '4e000000-0000-0000-0000-000000000001'),
  'archivada',
  'the question is archived, not deleted'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select throws_ok(
  $$select public.archive_question('4e000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'question.not_found',
  'a client cannot archive a question'
);

reset role;

select * from finish();

rollback;
