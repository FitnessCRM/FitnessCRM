begin;

select plan(22);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.measurement_types (id, trainer_id, label, unit, sort_order) values
  ('3e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cintura', 'cm', 0);

insert into public.questionnaire_questions (id, trainer_id, prompt, format_kind, scale_min, scale_max, sort_order) values
  ('4e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sueño', 'escala', 0, 10, 0);

insert into public.exercises (id, trainer_id, name) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Sentadilla');

insert into public.routines (id, trainer_id, client_id, status, name) values
  ('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'activo', 'Rutina activa');

insert into public.routine_days (routine_id, id, trainer_id, position, day_number) values
  ('10000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 0, 1);

insert into public.routine_day_exercises (routine_id, id, routine_day_id, trainer_id, exercise_id, position, sets, reps_min) values
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 0, 3, 8);

insert into public.weight_logs (id, trainer_id, client_id, log_date, weight_kg) values
  ('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-02-01', 80.5),
  ('77777777-7777-7777-7777-777777777702', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-02-02', 80.2),
  ('77777777-7777-7777-7777-777777777703', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-02-03', 80.0);

-- rv1 is sent and points at weight 03. rv2 is a draft and points at weight 02.
insert into public.reviews (id, trainer_id, client_id, week_number, window_start, window_end, status, weight_log_id, submitted_at) values
  ('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '2026-02-01', '2026-02-07', 'enviada', '77777777-7777-7777-7777-777777777703', now()),
  ('88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '2026-02-08', '2026-02-14', 'borrador', '77777777-7777-7777-7777-777777777702', null);

insert into public.review_media (trainer_id, review_id, pose, storage_path) values
  ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888801', 'frente',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/88888888-8888-8888-8888-888888888801/frente.jpg');

-- Client A1: writes their own weight, is refused on the date rules, and cannot delete a sent weigh-in.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select lives_ok(
  $$insert into public.weight_logs (trainer_id, client_id, log_date, weight_kg) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-02-10', 79.9)$$,
  'a client records their own weight'
);

select throws_ok(
  $$insert into public.weight_logs (trainer_id, client_id, log_date, weight_kg) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (now() at time zone 'Europe/Madrid')::date + 1, 79.9)$$,
  '23514',
  null,
  'a weight cannot be dated after today in the trainer zone (I27)'
);

select throws_ok(
  $$insert into public.weight_logs (trainer_id, client_id, log_date, weight_kg) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-12-31', 79.9)$$,
  '23514',
  null,
  'a weight cannot be dated before the client start date (I27)'
);

select throws_ok(
  $$delete from public.weight_logs where id = '77777777-7777-7777-7777-777777777703'$$,
  '23514',
  null,
  'a weigh-in of a sent review cannot be deleted (I25)'
);

select lives_ok(
  $$delete from public.weight_logs where id = '77777777-7777-7777-7777-777777777702'$$,
  'a weigh-in of a draft review can be deleted'
);

select lives_ok(
  $$insert into public.workout_logs (trainer_id, client_id, exercise_id, routine_id, routine_day_exercise_id, log_date, set_number, weight_kg, reps) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', '2026-02-10', 1, 80, 8)$$,
  'a client logs a set on a line of their active routine'
);

select is((select count(*)::int from public.exercises), 1, 'a client reads the exercise of their routine and of their log');

update public.reviews set feedback_note = 'hola' where id = '88888888-8888-8888-8888-888888888801';

reset role;

select is(
  (select feedback_note from public.reviews where id = '88888888-8888-8888-8888-888888888801'),
  '',
  'a client cannot change a review directly: reviews are written by RPC only'
);

-- Integrity checks, through the owner (RLS bypassed; constraints and triggers still apply).
select throws_ok(
  $$insert into public.weight_logs (trainer_id, client_id, log_date, weight_kg) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-02-20', 401)$$,
  '23514',
  null,
  'a weight above 400 kg is rejected (I18)'
);

select throws_ok(
  $$insert into public.weight_logs (trainer_id, client_id, log_date, weight_kg) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-02-01', 81.0)$$,
  '23505',
  null,
  'one weight per client and date (I23)'
);

select ok(
  (select weight_log_id from public.reviews where id = '88888888-8888-8888-8888-888888888802') is null,
  'deleting the weigh-in of a draft clears its reference'
);

select throws_ok(
  $$insert into public.reviews (trainer_id, client_id, week_number, window_start, window_end, status) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '2026-02-01', '2026-02-07', 'borrador')$$,
  '23505',
  null,
  'one review per client and week (I16)'
);

select throws_ok(
  $$update public.reviews set frozen_weight_kg = 80, frozen_weight_date = '2026-02-08' where id = '88888888-8888-8888-8888-888888888802'$$,
  '23514',
  null,
  'an editable review carries no frozen weight copy (I24)'
);

select throws_ok(
  $$update public.reviews set status = 'vista', viewed_at = now() where id = '88888888-8888-8888-8888-888888888801'$$,
  '23514',
  null,
  'a viewed review with a weigh-in carries its frozen copy (I24)'
);

select throws_ok(
  $$update public.reviews set week_number = 9 where id = '88888888-8888-8888-8888-888888888802'$$,
  '23514',
  null,
  'the week of a review is frozen when it opens (I22)'
);

select throws_ok(
  $$insert into public.review_media (trainer_id, review_id, pose, storage_path) values
      ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888801', 'perfil',
       '99999999-9999-9999-9999-999999999999/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/88888888-8888-8888-8888-888888888801/perfil.jpg')$$,
  '23514',
  null,
  'a photo path must sit in the folder of its trainer and review'
);

select throws_ok(
  $$insert into public.review_media (trainer_id, review_id, pose, storage_path) values
      ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888801', 'frente',
       '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/88888888-8888-8888-8888-888888888801/frente-2.jpg')$$,
  '23505',
  null,
  'one photo per pose and review (ReviewMedia)'
);

select lives_ok(
  $$insert into public.review_measurements (trainer_id, review_id, measurement_type_id, value, label, unit) values
      ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888801', '3e000000-0000-0000-0000-000000000001', 82.0, 'Cintura', 'cm')$$,
  'a body measurement is recorded on a review'
);

select is(
  (select has_measurements from public.measurement_types where id = '3e000000-0000-0000-0000-000000000001'),
  true,
  'the first measurement raises the flag that freezes the unit (I26)'
);

select throws_ok(
  $$insert into public.questionnaire_responses (trainer_id, review_id, question_id, prompt, format_kind, scale_min, scale_max, value_number) values
      ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888801', '4e000000-0000-0000-0000-000000000001', 'Sueño', 'escala', 0, 10, 11)$$,
  '23514',
  null,
  'an answer must sit inside the frozen scale of its question (I12)'
);

-- The trainer receives sent reviews only, never drafts (§3, §7).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select is((select count(*)::int from public.reviews), 1, 'the trainer receives sent reviews, not drafts');

select is((select count(*)::int from public.workout_logs), 1, 'the trainer reads the training logs of their clients');

select * from finish();

rollback;
