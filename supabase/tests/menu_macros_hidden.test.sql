begin;

select plan(12);

-- E12: the client reads the declared menu macros only while macros_visible is true; the trainer always.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status, macros_visible) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo', false);

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.menus (id, trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g) values
  ('9e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'activo', 'Entreno', 'entrenamiento', true, 2000, 150, 200, 60);

insert into public.meals (menu_id, id, trainer_id, position, name) values
  ('9e000000-0000-0000-0000-000000000001', '9f000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 0, 'Desayuno');

set local role authenticated;

-- Client with the flag false.
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is(
  (select row(kcal, protein_g, carbs_g, fat_g)::text from public.menu_reads),
  row(null::int, null::numeric, null::numeric, null::numeric)::text,
  'with macros_visible false the client gets the menu without its kcal and macros (E12)'
);

select is((select name from public.menu_reads), 'Entreno', 'the rest of the menu still reaches the client');
select is((select count(*)::int from public.meals), 1, 'and so do its meals');

select throws_ok(
  $$select kcal from public.menus$$,
  '42501',
  null,
  'the table does not hand the macro columns to anyone signed in'
);

-- The trainer always reads them.
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select is((select kcal from public.menu_reads), 2000, 'the trainer always reads the declared kcal');

-- Client with the flag true.
reset role;
update public.clients set macros_visible = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select kcal from public.menu_reads), 2000, 'with macros_visible true the client reads the kcal');
select is((select fat_g from public.menu_reads), 60::numeric, 'and the macros');

-- Who stays out (card 123). menu_reads runs as its owner and skips the RLS of menus, so its where is
-- the only thing that keeps trainers and clients apart. A second trainer, a second client of trainer
-- A, and a draft and an archived menu for Marta.
reset role;

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'client-a2@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status, macros_visible) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Luis', 'A', 'luis@test.local', '2026-01-05', 7, 'activo', true);

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('44444444-4444-4444-4444-444444444444', 'client', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

insert into public.menus (id, trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g) values
  ('9e000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'borrador', 'Borrador', 'descanso', false, 1800, 140, 160, 60),
  ('9e000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'archivado', 'Antiguo', 'entrenamiento', false, 2200, 160, 230, 70);

set local role authenticated;

-- 1. Another trainer.
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select is((select count(*)::int from public.menu_reads), 0, 'a trainer reads no menu of another trainer');

-- 2. Another client of the same trainer.
set local "request.jwt.claims" to '{"sub":"44444444-4444-4444-4444-444444444444","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

select is((select count(*)::int from public.menu_reads), 0, 'a client reads no menu of another client of the same trainer');

-- 3. The client's own menus: only the active ones.
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is(
  (select array_agg(status::text order by status::text) from public.menu_reads),
  array['activo'],
  'a client reads their active menus, not their drafts or archived ones'
);

-- 4. A client dado de baja.
reset role;
update public.clients set status = 'dado_de_baja' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*)::int from public.menu_reads), 0, 'a client dado de baja reads no menu');

-- 5. Signed out.
reset role;
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select throws_ok(
  $$select * from public.menu_reads$$,
  '42501',
  null,
  'anon cannot read menu_reads'
);

select * from finish();
rollback;
