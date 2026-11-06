begin;

select plan(5);

-- E8: a plan cloned from a template keeps the template id next to its frozen name, and a new version
-- of the plan carries both over.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo');

insert into public.routine_templates (id, trainer_id, name, body) values
  ('7e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Hiper', '{"note":"","days":[]}');

insert into public.menu_templates (id, trainer_id, name, body) values
  ('7e000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Definición',
   '{"menus":[{"id":"8e000000-0000-0000-0000-000000000001","name":"Menú A","dayType":"entrenamiento","suggested":true,"macros":{"kcal":2000,"proteinG":150,"carbsG":200,"fatG":60},"note":"","meals":[]}]}');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select set_config('test.routine', public.assign_routine_template('7e000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::text, true);
select set_config('test.menu', (public.assign_menu_template('7e000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))[1]::text, true);

select is(
  (select source_template_id from public.routines where id = current_setting('test.routine')::uuid),
  '7e000000-0000-0000-0000-000000000001'::uuid,
  'an assigned routine keeps the id of its template (E8)'
);

select is(
  (select source_template_id from public.menus where id = current_setting('test.menu')::uuid),
  '7e000000-0000-0000-0000-000000000002'::uuid,
  'an assigned menu keeps the id of its template (E8)'
);

select public.activate_routine(current_setting('test.routine')::uuid);
select set_config('test.version', public.revise_routine(current_setting('test.routine')::uuid)::text, true);

select is(
  (select source_template_id from public.routines where id = current_setting('test.version')::uuid),
  '7e000000-0000-0000-0000-000000000001'::uuid,
  'a new version of the routine carries the template id over'
);

-- Renaming the template changes neither the frozen name nor the id: uses are counted by id.
update public.routine_templates set name = 'Hiper v2' where id = '7e000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.routines where source_template_id = '7e000000-0000-0000-0000-000000000001'),
  2,
  'renaming the template keeps its uses, counted by id'
);

select is(
  (select source_template_name from public.routines where id = current_setting('test.version')::uuid),
  'Hiper',
  'the frozen name stays as it was when assigned'
);

select * from finish();
rollback;
