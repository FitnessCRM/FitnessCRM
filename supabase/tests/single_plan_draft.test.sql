begin;

select plan(6);

-- I32 (E9): assigning a template over an existing draft asks first; replacing deletes the draft.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo');

insert into public.routine_templates (id, trainer_id, name, body) values
  ('7e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Hiper', '{"note":"","days":[]}');

insert into public.menu_templates (id, trainer_id, name, body) values
  ('7e000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Entreno',
   '{"menus":[{"id":"8e000000-0000-0000-0000-000000000001","name":"Menú A","dayType":"entrenamiento","suggested":true,"macros":{"kcal":2000,"proteinG":150,"carbsG":200,"fatG":60},"note":"","meals":[]}]}');

-- A draft menu on the rest day: it does not collide with a training-day template.
insert into public.menus (id, trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g) values
  ('9e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'borrador', 'Descanso', 'descanso', true, 1800, 140, 150, 60);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$select public.assign_routine_template('7e000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'the first assignment creates the draft'
);

select throws_ok(
  $$select public.assign_routine_template('7e000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'plan.draft_exists',
  'a second assignment over the draft asks first (I32)'
);

select lives_ok(
  $$select public.assign_routine_template('7e000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true)$$,
  'with confirmation the draft is replaced'
);

select is(
  (select count(*)::int from public.routines where client_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and status = 'borrador'),
  1,
  'after replacing there is still one draft routine (I32)'
);

select lives_ok(
  $$select public.assign_menu_template('7e000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'a draft on another day type does not block a menu template'
);

select throws_ok(
  $$select public.assign_menu_template('7e000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'plan.draft_exists',
  'a draft set on the same day type asks first (I32)'
);

select * from finish();
rollback;
