begin;

select plan(8);

-- Fixtures: trainer A with a published food and two measurement types and two questions; trainer B
-- with her own food, which trainer A must not touch.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.foods (id, trainer_id, name, kcal, protein_g, carbs_g, fat_g, publish_status, updated_at) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Avena', 370, 13, 60, 7, 'publicado', '2026-10-01 10:00:00.123456+00'),
  ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Arroz', 360, 7, 80, 1, 'publicado', '2026-10-02 09:00:00.123456+00'),
  ('f0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Pollo', 110, 23, 0, 2, 'publicado', '2026-10-01 10:00:00+00');

insert into public.measurement_types (id, trainer_id, label, unit, sort_order) values
  ('3e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cintura', 'cm', 0),
  ('3e000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Cadera', 'cm', 1);

insert into public.questionnaire_questions (id, trainer_id, prompt, format_kind, sort_order) values
  ('9e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sueño', 'texto', 0),
  ('9e000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Energía', 'texto', 1);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select public.archive_food('f0000000-0000-0000-0000-000000000001');
select is(
  (select status::text || '/' || publish_status::text from public.foods where id = 'f0000000-0000-0000-0000-000000000001'),
  'archivado/pendiente',
  'archive_food: the food leaves the catalog and waits for publication'
);

select public.mark_food_published('f0000000-0000-0000-0000-000000000002', '2026-10-02 09:00:00.123+00');
select is(
  (select publish_status::text from public.foods where id = 'f0000000-0000-0000-0000-000000000002'),
  'publicado',
  'mark_food_published: the current version, compared to the millisecond'
);

update public.foods set publish_status = 'pendiente' where id = 'f0000000-0000-0000-0000-000000000002';
select public.mark_food_published('f0000000-0000-0000-0000-000000000002', '2026-10-01 10:00:00.123+00');
select is(
  (select publish_status::text from public.foods where id = 'f0000000-0000-0000-0000-000000000002'),
  'pendiente',
  'mark_food_published: a stale version does not mark the food'
);

select public.reorder_measurement_types(array['3e000000-0000-0000-0000-000000000002', '3e000000-0000-0000-0000-000000000001']::uuid[]);
select is(
  (select array_agg(id::text order by sort_order) from public.measurement_types where trainer_id = '11111111-1111-1111-1111-111111111111'),
  array['3e000000-0000-0000-0000-000000000002', '3e000000-0000-0000-0000-000000000001'],
  'reorder_measurement_types: the listed order becomes the sort order'
);

select public.reorder_questions(array['9e000000-0000-0000-0000-000000000002', '9e000000-0000-0000-0000-000000000001']::uuid[]);
select is(
  (select sort_order from public.questionnaire_questions where id = '9e000000-0000-0000-0000-000000000002'),
  0,
  'reorder_questions: the first listed question is first'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select throws_ok(
  $$select public.archive_food('f0000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'food.not_found',
  'archive_food: another trainer cannot archive this food'
);

select public.reorder_measurement_types(array['3e000000-0000-0000-0000-000000000001']::uuid[]);

reset role;

-- Read as the owner of the database, past row level security: the order must still be trainer A's.
select is(
  (select sort_order from public.measurement_types where id = '3e000000-0000-0000-0000-000000000001'),
  1,
  'reorder_measurement_types: another trainer cannot reorder this catalog'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select public.archive_food('f0000000-0000-0000-0000-000000000001');
select is(
  (select publish_status::text from public.foods where id = 'f0000000-0000-0000-0000-000000000001'),
  'pendiente',
  'archive_food: archiving again changes nothing'
);

reset role;

select * from finish();
rollback;
