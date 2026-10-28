begin;

select plan(13);

-- Fixtures: trainer A with a writable client, a client who has left, an active routine, two active
-- menus (one per day type) and a library with a food; trainer B, who must not see any of it.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, status, start_date, review_every_days) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Marta', 'Ruiz', 'marta@test.local', 'activo', '2026-10-01', 7),
  ('c2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Luis', 'Gil', 'luis@test.local', 'dado_de_baja', '2026-01-05', 7);

insert into public.exercises (id, trainer_id, name) values
  ('e1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sentadilla'),
  ('e2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Remo');

insert into public.foods (id, trainer_id, name, kcal, protein_g, carbs_g, fat_g, publish_status) values
  ('f1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Avena', 370, 13, 60, 7, 'publicado');

insert into public.routines (id, trainer_id, client_id, status, name, source_template_name) values
  ('b1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'activo', 'Plan activo', 'Plantilla base');

insert into public.menus (id, trainer_id, client_id, status, name, day_type, kcal, protein_g, carbs_g, fat_g) values
  ('a2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'activo', 'Menú activo', 'entrenamiento', 2000, 150, 200, 60),
  ('a2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'activo', 'Descanso activo', 'descanso', 1800, 140, 150, 60);

insert into public.menu_templates (id, trainer_id, name, body) values
  ('ab000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Plantilla menú', '{"menus":[{"id":"ac000000-0000-0000-0000-000000000001","name":"Descanso","dayType":"descanso","suggested":true,"macros":{"kcal":1800,"proteinG":140,"carbsG":150,"fatG":60},"note":"","meals":[]}]}');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

do $$
begin
perform public.create_routine_draft(
  'c1000000-0000-0000-0000-000000000001',
  '{"name":"Fuerza A","note":"","days":[{"id":"d1000000-0000-0000-0000-000000000001","dayNumber":1,"label":"Torso","exercises":[{"id":"ee000000-0000-0000-0000-000000000001","exerciseId":"e1000000-0000-0000-0000-000000000001","prescription":{"sets":3,"repsMin":8,"repsMax":10,"rir":"2","rest":"90 s","note":""}},{"id":"ee000000-0000-0000-0000-000000000002","exerciseId":"e2000000-0000-0000-0000-000000000002","prescription":{"sets":3,"repsMin":10,"repsMax":null,"rir":"","rest":"","note":""}}]}]}'::jsonb
);
end $$;

select is(
  (select count(*)::int from public.routine_day_exercises e join public.routines r on r.id = e.routine_id where r.name = 'Fuerza A'),
  2,
  'create_routine_draft: the draft holds the two prescribed lines'
);

select ok(
  exists (select 1 from public.routine_day_exercises where id = 'ee000000-0000-0000-0000-000000000001' and routine_day_id = 'd1000000-0000-0000-0000-000000000001'),
  'create_routine_draft: days and lines keep the ids of the body (§7)'
);

do $$
begin
perform public.replace_routine_draft(
  (select id from public.routines where name = 'Fuerza A'),
  '{"name":"Fuerza A","note":"Sube peso","days":[{"id":"d1000000-0000-0000-0000-000000000001","dayNumber":1,"label":"Torso","exercises":[{"id":"ee000000-0000-0000-0000-000000000001","exerciseId":"e1000000-0000-0000-0000-000000000001","prescription":{"sets":4,"repsMin":6,"repsMax":8,"rir":"1","rest":"","note":""}}]}]}'::jsonb
);
end $$;

select is(
  (select sets from public.routine_day_exercises where id = 'ee000000-0000-0000-0000-000000000001'),
  4,
  'replace_routine_draft: the draft is rewritten, and the line keeps its id'
);

select throws_ok(
  $$select public.replace_routine_draft('b1000000-0000-0000-0000-000000000001', '{"name":"Otro","note":"","days":[]}'::jsonb)$$,
  'P0001',
  'routine.not_draft',
  'replace_routine_draft: an active routine is never edited in place (§7)'
);

do $$
begin
perform public.revise_routine_draft(
  'b1000000-0000-0000-0000-000000000001',
  '{"name":"Plan activo v2","note":"","days":[]}'::jsonb
);
end $$;

select is(
  (select source_template_name from public.routines where name = 'Plan activo v2'),
  'Plantilla base',
  'revise_routine_draft: the new draft keeps the template it came from'
);

select is(
  (select status::text from public.routines where id = 'b1000000-0000-0000-0000-000000000001'),
  'activo',
  'revise_routine_draft: the active routine stays active until the draft is activated'
);

select throws_ok(
  $$select public.create_routine_draft('c2000000-0000-0000-0000-000000000002', '{"name":"Nueva","note":"","days":[]}'::jsonb)$$,
  'P0001',
  'client.not_writable',
  'create_routine_draft: a client who has left takes no new routine'
);

do $$
begin
perform public.create_menu_draft(
  'c1000000-0000-0000-0000-000000000001',
  '{"name":"Menú de entreno","dayType":"entrenamiento","suggested":true,"macros":{"kcal":2000,"proteinG":150,"carbsG":200,"fatG":60},"note":"","meals":[{"id":"ca000000-0000-0000-0000-000000000001","name":"Desayuno","items":[{"id":"ce000000-0000-0000-0000-000000000001","name":"Avena","grams":80,"foodId":"f1000000-0000-0000-0000-000000000001","composition":{"kcal":296,"proteinG":10.4,"carbsG":48,"fatG":5.6}},{"id":"ce000000-0000-0000-0000-000000000002","name":"Ensalada libre","grams":100}]}]}'::jsonb
);
end $$;

select is(
  (select count(*)::int from public.menu_items where food_id = 'f1000000-0000-0000-0000-000000000001' and kcal = 296)
    + (select count(*)::int from public.menu_items where food_id is null and name = 'Ensalada libre'),
  2,
  'create_menu_draft: a library item keeps its frozen composition, a free text item has none (I29, I30)'
);

select throws_ok(
  $$select public.activate_menus('c1000000-0000-0000-0000-000000000001', 'descanso')$$,
  'P0001',
  'menu.no_drafts',
  'activate_menus: without drafts it fails'
);

select is(
  (select status::text from public.menus where id = 'a2000000-0000-0000-0000-000000000002'),
  'activo',
  'activate_menus: a failed activation archives nothing'
);

select is(
  public.activate_menus('c1000000-0000-0000-0000-000000000001', 'entrenamiento'),
  1,
  'activate_menus: publishes the drafts of that day type and archives the active set'
);

select is(
  array_length(public.assign_menu_template('ab000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'), 1),
  1,
  'assign_menu_template: returns the ids of the draft menus it created'
);

-- Trainer B reads and writes nothing of trainer A: the routine is not found for her.
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select throws_ok(
  $$select public.replace_routine_draft('b1000000-0000-0000-0000-000000000001', '{"name":"Ajena","note":"","days":[]}'::jsonb)$$,
  'P0001',
  'routine.not_found',
  'replace_routine_draft: another trainer cannot touch this routine'
);

reset role;

select * from finish();
rollback;
