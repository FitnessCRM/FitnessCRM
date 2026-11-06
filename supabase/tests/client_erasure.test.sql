begin;

select plan(9);

-- E11 (I14): a discharged client is erased on request, photos first; nothing of them is left.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'baja@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Baja', 'A', 'baja@test.local', '2026-01-05', 7, 'dado_de_baja'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'Activa', 'A', 'activa@test.local', '2026-01-05', 7, 'activo');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.weight_logs (id, trainer_id, client_id, log_date, weight_kg) values
  ('5e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-10', 70);

insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mensual', '2026-01-05', '2026-02-04', 'pagada');

insert into storage.objects (bucket_id, name) values
  ('review-photos', '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/r1/frente.jpg');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$ select public.client_erasure_paths('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab') $$,
  'P0001',
  'client.not_discharged',
  'an active client is not erased: first they are discharged (I14)'
);

select is(
  public.client_erasure_paths('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  array['11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/r1/frente.jpg'],
  'the photos of the client in Storage are listed for deletion'
);

select throws_ok(
  $$ select public.erase_client('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'P0001',
  'client.photos_remaining',
  'the rows are not deleted while a photo is left in Storage: the app can check they went'
);

-- The Edge Function deletes the object with the service key.
reset role;
-- Storage forbids SQL deletes outside its API; the test stands in for the API call.
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'review-photos';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select is(
  public.erase_client('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  array['22222222-2222-2222-2222-222222222222'::uuid],
  'erasing returns the account of the client, to delete it from Auth'
);

reset role;

select is((select count(*)::int from public.clients where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'the client is gone, not anonymised');
select is((select count(*)::int from public.weight_logs), 0, 'and their weight logs');
select is((select count(*)::int from public.memberships), 0, 'and their memberships');
select is((select count(*)::int from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'), 0, 'and their profile');

-- Another trainer cannot erase someone else's client.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select throws_ok(
  $$ select public.erase_client('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab') $$,
  'P0001',
  'client.not_found',
  'another trainer cannot erase a client that is not theirs'
);

select * from finish();
rollback;
