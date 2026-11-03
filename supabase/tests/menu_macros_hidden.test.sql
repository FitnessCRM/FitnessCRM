begin;

select plan(7);

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

select * from finish();
rollback;
