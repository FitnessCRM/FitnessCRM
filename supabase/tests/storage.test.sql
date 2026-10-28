begin;

select plan(9);

-- Fixture: one photo of client A1, written as the owner (bypasses RLS).
insert into storage.objects (bucket_id, name) values
  ('review-photos', '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/rev-1/frente.jpg');

select is(
  (select public from storage.buckets where id = 'review-photos'),
  false,
  'review-photos bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'review-photos'),
  10485760::bigint,
  'review-photos bucket limits uploads to 10 MB'
);

-- Client A1 uploads a photo into their own folder.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
      ('review-photos', '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/rev-2/perfil.jpg')$$,
  'client can upload into their own folder'
);

-- Client A1 cannot write into the folder of another client of the same trainer.
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
      ('review-photos', '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab/rev-1/frente.jpg')$$,
  '42501',
  null,
  'client cannot upload into another client folder'
);

-- No user policy grants delete on review photos. Objects are removed only by the service role
-- (Edge Function). Direct deletes from storage tables are blocked by Supabase in any case.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'review_photos%'
      and cmd in ('DELETE', 'ALL')),
  0,
  'no user policy grants delete on review photos'
);

-- Trainer A reads photos of their tenant.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select is(
  (select count(*)::int from storage.objects where bucket_id = 'review-photos'),
  2,
  'trainer A reads the photos of their tenant'
);

-- Trainer B sees none of trainer A photos.
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select is(
  (select count(*)::int from storage.objects where bucket_id = 'review-photos'),
  0,
  'trainer B reads no photos of trainer A'
);

-- Anonymous reads nothing.
set local role anon;

select is(
  (select count(*)::int from storage.objects where bucket_id = 'review-photos'),
  0,
  'anon reads no photos'
);

reset role;

select is(
  (select count(*)::int from storage.objects where bucket_id = 'review-photos'),
  2,
  'fixture photos are intact after the checks'
);

select * from finish();

rollback;
