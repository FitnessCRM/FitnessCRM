begin;

select plan(6);

-- Fixtures: trainer A with two clients, one of them with a received review, and a draft that the
-- trainer must never see; trainer B, who must see none of it.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, status, start_date, review_every_days) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ángela', 'Pérez', 'angela@test.local', 'activo', '2026-10-01', 7),
  ('c2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Luis', 'Gil', 'luis@test.local', 'activo', '2026-10-01', 7);

insert into public.reviews (id, trainer_id, client_id, week_number, window_start, window_end, status, submitted_at, viewed_at) values
  ('d1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 1, '2026-10-01', '2026-10-07', 'enviada', now() - interval '1 day', null),
  ('d2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'c2000000-0000-0000-0000-000000000002', 1, '2026-10-01', '2026-10-07', 'vista', now() - interval '3 days', now() - interval '2 days'),
  ('d3000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 2, '2026-10-08', '2026-10-14', 'borrador', null, null);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select is(
  (public.list_reviews_tracking('11111111-1111-1111-1111-111111111111', 'todas', '', 0, 10)->'counts'->>'todas')::int,
  2,
  'list_reviews_tracking: drafts are never received, so they are not counted'
);

select is(
  public.list_reviews_tracking('11111111-1111-1111-1111-111111111111', 'todas', '', 0, 10)->'ids'->>0,
  'd1000000-0000-0000-0000-000000000001',
  'list_reviews_tracking: the sent review comes first, then the viewed ones'
);

select is(
  (public.list_reviews_tracking('11111111-1111-1111-1111-111111111111', 'todas', 'ANGELA', 0, 10)->'counts'->>'todas')::int,
  1,
  'list_reviews_tracking: the search ignores case and accents'
);

select is(
  jsonb_array_length(public.list_reviews_tracking('11111111-1111-1111-1111-111111111111', 'vista', '', 0, 10)->'ids'),
  1,
  'list_reviews_tracking: the filter keeps only the chosen status'
);

select is(
  (public.list_reviews_tracking('11111111-1111-1111-1111-111111111111', 'todas', '', 1, 1)->'ids'->>0),
  'd2000000-0000-0000-0000-000000000002',
  'list_reviews_tracking: the second page starts where the first one ends'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select is(
  (public.list_reviews_tracking('11111111-1111-1111-1111-111111111111', 'todas', '', 0, 10)->'counts'->>'todas')::int,
  0,
  'list_reviews_tracking: another trainer sees none of these reviews'
);

reset role;

select * from finish();
rollback;
