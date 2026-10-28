begin;

select plan(13);

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

insert into public.foods (id, trainer_id, name, kcal, protein_g, carbs_g, fat_g) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Avena', 370, 13.0, 60.0, 7.0),
  ('f0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Pollo', 110, 23.0, 0.0, 2.0);

insert into public.measurement_types (id, trainer_id, label, unit, sort_order) values
  ('3e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cintura', 'cm', 0),
  ('3e000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Cadera', 'cm', 1);

insert into public.questionnaire_questions (id, trainer_id, prompt, format_kind, scale_min, scale_max, sort_order) values
  ('4e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sueño', 'escala', 0, 10, 0);

-- Food library: the macros of 100 g cannot exceed 100 g (§5).
select throws_ok(
  $$insert into public.foods (trainer_id, name, kcal, protein_g, carbs_g, fat_g) values
      ('11111111-1111-1111-1111-111111111111', 'Exceso', 500, 60.0, 40.0, 1.0)$$,
  '23514',
  null,
  'food macros above 100 g per 100 g are rejected'
);

select lives_ok(
  $$insert into public.foods (trainer_id, name, kcal, protein_g, carbs_g, fat_g) values
      ('11111111-1111-1111-1111-111111111111', 'Limite', 400, 60.0, 30.0, 10.0)$$,
  'food macros summing exactly 100 g are accepted'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select is((select count(*)::int from public.foods), 2, 'trainer A sees their own foods only');

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select is((select count(*)::int from public.foods), 1, 'trainer B does not see the foods of trainer A');

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*)::int from public.foods), 0, 'a client reads no food library');

-- Food is archived, never deleted (I13): the delete affects no row.
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

delete from public.foods where id = 'f0000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.foods where id = 'f0000000-0000-0000-0000-000000000001'),
  1,
  'a food cannot be deleted through the API (I13)'
);

-- Measurement types: fixtures set the flag as the trigger would after a first measurement.
reset role;

update public.measurement_types set has_measurements = true where id = '3e000000-0000-0000-0000-000000000001';
update public.questionnaire_questions set has_responses = true where id = '4e000000-0000-0000-0000-000000000001';

select throws_ok(
  $$update public.measurement_types set unit = 'in' where id = '3e000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'the unit of a measurement type is frozen after its first measurement (I26)'
);

select throws_ok(
  $$update public.measurement_types set has_measurements = false where id = '3e000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'the has_measurements flag cannot be cleared (I26)'
);

select lives_ok(
  $$update public.measurement_types set unit = 'in' where id = '3e000000-0000-0000-0000-000000000002'$$,
  'the unit can change while the type has no measurements'
);

select throws_ok(
  $$update public.questionnaire_questions set scale_max = 20 where id = '4e000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'the format of a question is frozen after its first response (I15)'
);

select throws_ok(
  $$insert into public.questionnaire_questions (trainer_id, prompt, format_kind, scale_min, scale_max, sort_order) values
      ('11111111-1111-1111-1111-111111111111', 'Invalida', 'escala', 5, 3, 1)$$,
  '23514',
  null,
  'a scale question needs a minimum below its maximum'
);

-- The client reads the catalog of their trainer to answer a review.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*)::int from public.measurement_types), 2, 'a client reads the measurement types of their trainer');

select is((select count(*)::int from public.questionnaire_questions), 1, 'a client reads the questionnaire of their trainer');

select * from finish();

rollback;
