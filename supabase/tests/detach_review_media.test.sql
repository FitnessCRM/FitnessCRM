begin;

select plan(8);

-- Card 17: the client removes a photo while the review is editable (I17, §9).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'client-a2@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'client-a1@test.local', '2026-01-05', 7, 'activo'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Sara', 'A', 'client-a2@test.local', '2026-01-05', 7, 'activo');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('44444444-4444-4444-4444-444444444444', 'client', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- rv1 is a draft with two photos; rv2 was already viewed by the trainer.
insert into public.reviews (id, trainer_id, client_id, week_number, window_start, window_end, status, submitted_at, viewed_at) values
  ('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '2026-02-01', '2026-02-07', 'borrador', null, null),
  ('88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '2026-02-08', '2026-02-14', 'vista', now(), now());

insert into public.review_media (trainer_id, review_id, pose, storage_path) values
  ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888801', 'frente',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/88888888-8888-8888-8888-888888888801/frente.jpg'),
  ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888801', 'perfil',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/88888888-8888-8888-8888-888888888801/perfil.jpg'),
  ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888802', 'frente',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/88888888-8888-8888-8888-888888888802/frente.jpg');

set local role authenticated;

-- Another client of the same trainer cannot remove it.
set local "request.jwt.claims" to '{"sub":"44444444-4444-4444-4444-444444444444","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"cccccccc-cccc-cccc-cccc-cccccccccccc"}';

select throws_ok(
  $$select public.detach_review_media('88888888-8888-8888-8888-888888888801', 'frente')$$,
  'P0001',
  'review.not_found',
  'another client cannot remove the photo'
);

-- The trainer does not write photos.
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$select public.detach_review_media('88888888-8888-8888-8888-888888888801', 'frente')$$,
  'P0001',
  'review.not_found',
  'the trainer cannot remove a photo of the client'
);

set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is(
  public.detach_review_media('88888888-8888-8888-8888-888888888801', 'frente'),
  '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/88888888-8888-8888-8888-888888888801/frente.jpg',
  'the client removes the front photo and gets back its path, to delete the object'
);

select is(
  (select array_agg(pose::text) from public.review_media where review_id = '88888888-8888-8888-8888-888888888801'),
  array['perfil'],
  'only that pose loses its photo'
);

select is(
  public.detach_review_media('88888888-8888-8888-8888-888888888801', 'espalda'),
  null,
  'a pose without photo returns null: nothing to delete'
);

select throws_ok(
  $$select public.detach_review_media('88888888-8888-8888-8888-888888888802', 'frente')$$,
  'P0001',
  'review.not_editable',
  'a viewed review keeps its photos (I17)'
);

reset role;

select is(
  (select count(*)::int from public.review_media where review_id = '88888888-8888-8888-8888-888888888802'),
  1,
  'and its photo stays registered'
);

select ok(
  not has_function_privilege('anon', 'public.detach_review_media(uuid, public.review_pose)', 'execute'),
  'anon cannot call it'
);

select * from finish();
rollback;
