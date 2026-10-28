begin;

select plan(21);

-- Fixtures: trainer A with four clients (one with a new review, one with an active routine, one
-- churned, one with no history) and trainer B with one client that trainer A must never see.
-- Today is 2026-10-28 in every call below.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, status, start_date, review_every_days) values
  ('cc000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', 'activo', '2026-01-05', 7),
  ('cc000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Luis', 'A', 'luis@test.local', 'invitado', '2026-10-01', 7),
  ('cc000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Ana', 'A', 'ana@test.local', 'dado_de_baja', '2026-01-05', 7),
  ('cc000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Carlos', 'A', 'carlos@test.local', 'activo', '2026-01-05', 7),
  ('ee000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Ajena', 'B', 'ajena@test.local', 'activo', '2026-01-05', 7);

insert into public.routines (id, trainer_id, client_id, status, name) values
  ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-000000000001', 'activo', 'Fuerza A');

-- Marta: an older reviewed week, and a sent week 4 submitted last. Carlos has only a draft.
insert into public.reviews (trainer_id, client_id, week_number, window_start, window_end, status, submitted_at, viewed_at) values
  ('11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-000000000001', 3, '2026-10-12', '2026-10-18', 'vista', '2026-10-13 10:00+00', '2026-10-14 09:00+00'),
  ('11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-000000000001', 4, '2026-10-19', '2026-10-25', 'enviada', '2026-10-20 10:00+00', null),
  ('11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-000000000004', 4, '2026-10-19', '2026-10-25', 'borrador', null, null);

-- Memberships. M1 contains today; M2 overlaps M1 for Marta; M3 (Luis) ends in 6 days; M4 (Ana) is over.
insert into public.memberships (id, trainer_id, client_id, type, start_date, end_date, payment_status) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-000000000001', 'trimestral', '2026-09-01', '2026-11-30', 'pagada'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-000000000001', 'mensual', '2026-11-15', '2026-12-15', 'no_pagada'),
  ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-000000000002', 'mensual', '2026-10-01', '2026-11-03', 'pagada'),
  ('d0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-000000000003', 'trimestral', '2026-01-01', '2026-03-31', 'no_pagada');

-- Trainer A reads her own book. Row level security applies to these calls.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select is(
  (select count(*)::int from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'todos', null, '2026-10-28', 0, 10)),
  4,
  'tracking: the whole book, four clients'
);

select is(
  (select first_name::text from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'todos', null, '2026-10-28', 0, 10) limit 1),
  'Marta',
  'tracking: a new review comes first'
);

select is(
  (select new_review_week from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'todos', 'cc000000-0000-0000-0000-000000000001', '2026-10-28', 0, 10)),
  4,
  'tracking: the sent review of the week is exposed'
);

select is(
  (select routine_name from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'todos', 'cc000000-0000-0000-0000-000000000001', '2026-10-28', 0, 10)),
  'Fuerza A',
  'tracking: the active routine name'
);

select is(
  (select last_review_at from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'todos', 'cc000000-0000-0000-0000-000000000001', '2026-10-28', 0, 10)),
  '2026-10-20 10:00:00+00'::timestamptz,
  'tracking: the last submitted review, not a draft'
);

select is(
  (select current_membership->>'id' from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'todos', 'cc000000-0000-0000-0000-000000000001', '2026-10-28', 0, 10)),
  'd0000000-0000-0000-0000-000000000001',
  'tracking: the membership that contains today'
);

select is(
  (select count(*)::int from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'activo', null, '2026-10-28', 0, 10)),
  2,
  'tracking: filter by status'
);

select is(
  (select current_membership from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'dado_de_baja', null, '2026-10-28', 0, 10)),
  null,
  'tracking: no membership contains today for a churned client'
);

select is(
  (select array_agg(first_name::text order by first_name) from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'todos', null, '2026-10-28', 1, 2)),
  array['Carlos', 'Luis'],
  'tracking: second page, after new review and then name'
);

select is(
  (select count(*)::int from public.list_memberships_with_clients('11111111-1111-1111-1111-111111111111', null, 'all', '2026-10-28', 0, 10)),
  4,
  'memberships: the whole book'
);

select is(
  (select id from public.list_memberships_with_clients('11111111-1111-1111-1111-111111111111', null, 'all', '2026-10-28', 0, 10) limit 1),
  'd0000000-0000-0000-0000-000000000002'::uuid,
  'memberships: most recent start first'
);

select is(
  (select count(*)::int from public.list_memberships_with_clients('11111111-1111-1111-1111-111111111111', null, 'all', '2026-10-28', 0, 10) where overlapping),
  2,
  'memberships: both sides of an overlap are flagged, and only them'
);

select is(
  (select count(*)::int from public.list_memberships_with_clients('11111111-1111-1111-1111-111111111111', null, 'unpaid', '2026-10-28', 0, 10)),
  2,
  'memberships: unpaid filter'
);

select is(
  (select array_agg(id::text) from public.list_memberships_with_clients('11111111-1111-1111-1111-111111111111', null, 'expiring', '2026-10-28', 0, 10)),
  array['d0000000-0000-0000-0000-000000000003'],
  'memberships: expiring means in force with 7 days or less left'
);

select is(
  (select count(*)::int from public.list_memberships_with_clients('11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-000000000001', 'all', '2026-10-28', 0, 10)),
  2,
  'memberships: one client''s history'
);

select is(
  (select client_first_name::text from public.list_memberships_with_clients('11111111-1111-1111-1111-111111111111', null, 'expiring', '2026-10-28', 0, 10)),
  'Luis',
  'memberships: each row carries its client'
);

reset role;

-- Trainer B: the same calls, with trainer A's id, return nothing; her own book is visible.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select is(
  (select count(*)::int from public.list_clients_tracking('11111111-1111-1111-1111-111111111111', 'todos', null, '2026-10-28', 0, 10)),
  0,
  'tracking: another trainer cannot read this book'
);

select is(
  (select count(*)::int from public.list_memberships_with_clients('11111111-1111-1111-1111-111111111111', null, 'all', '2026-10-28', 0, 10)),
  0,
  'memberships: another trainer cannot read this book'
);

select is(
  (select first_name::text from public.list_clients_tracking('33333333-3333-3333-3333-333333333333', 'todos', null, '2026-10-28', 0, 10)),
  'Ajena',
  'tracking: a trainer reads her own book'
);

select is(
  (select count(*)::int from public.list_clients_tracking('33333333-3333-3333-3333-333333333333', 'todos', 'cc000000-0000-0000-0000-000000000001', '2026-10-28', 0, 10)),
  0,
  'tracking: a client of another trainer is not found by id'
);

select is(
  (select count(*)::int from public.list_memberships_with_clients('33333333-3333-3333-3333-333333333333', null, 'all', '2026-10-28', 0, 10)),
  0,
  'memberships: a trainer with no memberships sees none'
);

reset role;

select * from finish();
rollback;
