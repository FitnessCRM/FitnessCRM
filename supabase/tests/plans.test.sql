begin;

select plan(19);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status, macros_visible) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'Luis', 'A', 'luis@test.local', '2026-01-05', 7, 'dado_de_baja', true);

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.exercises (id, trainer_id, name) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Sentadilla'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '33333333-3333-3333-3333-333333333333', 'Ajeno');

-- Routine ra1: active, client A1. rd1: draft of client A1. ra2: active, client dado de baja.
insert into public.routines (id, trainer_id, client_id, status, name) values
  ('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'activo', 'Rutina activa'),
  ('10000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'borrador', 'Borrador'),
  ('10000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'activo', 'Rutina de baja');

insert into public.routine_days (routine_id, id, trainer_id, position, day_number, label) values
  ('10000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 0, 1, 'Torso');

insert into public.routine_day_exercises (routine_id, id, routine_day_id, trainer_id, exercise_id, position, sets, reps_min, reps_max) values
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 0, 3, 8, 10);

insert into public.menus (id, trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g) values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'activo', 'Menu entreno', 'entrenamiento', true, 2400, 180, 250, 70);

insert into public.meals (menu_id, id, trainer_id, position, name) values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '11111111-1111-1111-1111-111111111111', 0, 'Comida');

insert into public.macro_targets (id, trainer_id, client_id, day_type, status, kcal, protein_g, carbs_g, fat_g) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a101', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'entrenamiento', 'activo', 2400, 180, 250, 70);

insert into public.routine_templates (trainer_id, name, body) values
  ('11111111-1111-1111-1111-111111111111', 'Plantilla', '{"note": "", "days": []}'::jsonb);

-- Draft routine: the trainer creates it for an active client.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$insert into public.routines (trainer_id, client_id, name) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nueva')$$,
  'the trainer creates a draft routine for an active client'
);

select throws_ok(
  $$insert into public.routines (trainer_id, client_id, name) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'Para baja')$$,
  '42501',
  null,
  'the trainer cannot create a routine for a client dado de baja (§7)'
);

select throws_ok(
  $$update public.routines set status = 'activo' where id = '10000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'a draft cannot be activated directly through the API (§7)'
);

update public.routines set name = 'Cambiada' where id = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  $$insert into public.routine_day_exercises (routine_id, routine_day_id, trainer_id, exercise_id, position, sets, reps_min)
    values ('10000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1, 3, 8)$$,
  '42501',
  null,
  'lines of an active routine cannot be written in place (§7)'
);

select is((select count(*)::int from public.routines), 4, 'trainer A sees their routines, active and draft');

reset role;

select is(
  (select name from public.routines where id = '10000000-0000-0000-0000-000000000001'),
  'Rutina activa',
  'the update of an active routine is ignored by the API'
);

-- Client A1 sees only the active routine of their own. The draft and the other client are hidden.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*)::int from public.routines), 1, 'a client reads only the active routine of their own');

select is((select count(*)::int from public.routine_day_exercises), 1, 'a client reads the lines of their active routine');

select is((select count(*)::int from public.exercises), 1, 'a client reads the exercises of their active routine');

-- A client dado de baja has no access at all (§7).
set local "request.jwt.claims" to '{"sub":"55555555-5555-5555-5555-555555555555","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab"}';

select is((select count(*)::int from public.routines), 0, 'a client dado de baja reads no routine');

-- Trainer B sees none of the plans of trainer A.
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select is((select count(*)::int from public.routines), 0, 'trainer B reads no routine of trainer A');

-- Client A1 reads no templates: they are the trainer's library.
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*)::int from public.routine_templates), 0, 'a client reads no routine template');

-- Integrity checks, through the owner (RLS bypassed; constraints and triggers still apply).
reset role;

select throws_ok(
  $$insert into public.routine_day_exercises (routine_id, routine_day_id, trainer_id, exercise_id, position, sets, reps_min)
    values ('10000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 1, 3, 8)$$,
  '23503',
  null,
  'a routine only uses exercises of its own trainer (I3)'
);

select throws_ok(
  $$insert into public.routine_day_exercises (routine_id, routine_day_id, trainer_id, exercise_id, position, sets, reps_min, reps_max)
    values ('10000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 2, 3, 10, 8)$$,
  '23514',
  null,
  'the maximum reps of a prescription cannot be below its minimum'
);

select throws_ok(
  $$insert into public.menus (trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'activo', 'Otro', 'entrenamiento', true, 2000, 150, 200, 60)$$,
  '23505',
  null,
  'only one suggested menu per active set and day type (§3)'
);

select throws_ok(
  $$insert into public.menu_items (menu_id, meal_id, trainer_id, position, name, grams, food_id)
    values ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '11111111-1111-1111-1111-111111111111', 0, 'Avena', 80, 'f0000000-0000-0000-0000-000000000001')$$,
  '23514',
  null,
  'a library item keeps its frozen composition, all of it (I29)'
);

select throws_ok(
  $$insert into public.menu_items (menu_id, meal_id, trainer_id, position, name, grams, food_id, kcal, protein_g, carbs_g, fat_g)
    values ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '11111111-1111-1111-1111-111111111111', 1, 'Avena', 80, 'f0000000-0000-0000-0000-000000000001', 370, 60.0, 50.0, 1.0)$$,
  '23514',
  null,
  'the frozen macros of an item cannot exceed 100 g per 100 g (§5)'
);

select throws_ok(
  $$insert into public.macro_targets (trainer_id, client_id, day_type, status, kcal, protein_g, carbs_g, fat_g)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'entrenamiento', 'activo', 2000, 150, 200, 60)$$,
  '23505',
  null,
  'one active macro target per client and day type (I4)'
);

-- I11: the client reads their macro targets only while macrosVisible is not false.
update public.clients set macros_visible = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*)::int from public.macro_targets), 0, 'a client does not read their macros while macrosVisible is false (I11)');

select * from finish();

rollback;
