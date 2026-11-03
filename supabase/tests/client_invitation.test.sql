begin;

select plan(10);

-- Fixtures: a trainer with two invited clients and one already active; the invitee of the first client
-- has a verified email, the invitee of the second one has not verified it yet, and a third account
-- with a verified email of its own.
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local', now()),
  ('a1000000-0000-0000-0000-000000000001', 'angela@test.local', now()),
  ('a2000000-0000-0000-0000-000000000002', 'luis@test.local', null),
  ('a3000000-0000-0000-0000-000000000003', 'otra@test.local', now());

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, status, start_date, review_every_days) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ángela', 'Pérez', 'angela@test.local', 'invitado', '2026-10-01', 7),
  ('c2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Luis', 'Gil', 'luis@test.local', 'invitado', '2026-10-01', 7);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000001","email":"angela@test.local"}';

-- I33 (C1): without the consent version the account is not activated, and the link is not spent.
select throws_ok(
  $$ select public.accept_client_invitation('c1000000-0000-0000-0000-000000000001', null) $$,
  'P0001',
  'invitation.consent_required',
  'accept_client_invitation: without accepting the consent the client is not activated (I33)'
);

select is(
  public.accept_client_invitation('c1000000-0000-0000-0000-000000000001', '2026-11-03-borrador')::text,
  'c1000000-0000-0000-0000-000000000001',
  'accept_client_invitation: the invitee with a verified matching email gets her client'
);

select throws_ok(
  $$ select public.accept_client_invitation('c1000000-0000-0000-0000-000000000001', '2026-11-03-borrador') $$,
  'P0001',
  'invitation.not_found',
  'accept_client_invitation: an accepted invitation cannot be accepted again'
);

set local "request.jwt.claims" to '{"sub":"a3000000-0000-0000-0000-000000000003","email":"otra@test.local"}';

select throws_ok(
  $$ select public.accept_client_invitation('c2000000-0000-0000-0000-000000000002', '2026-11-03-borrador') $$,
  'P0001',
  'invitation.not_found',
  'accept_client_invitation: another email cannot accept someone else''s invitation'
);

set local "request.jwt.claims" to '{"sub":"a2000000-0000-0000-0000-000000000002","email":"luis@test.local"}';

select throws_ok(
  $$ select public.accept_client_invitation('c2000000-0000-0000-0000-000000000002', '2026-11-03-borrador') $$,
  'P0001',
  'invitation.email_not_verified',
  'accept_client_invitation: an unverified email is rejected before looking at the client'
);

reset role;

select is(
  (select status::text from public.clients where id = 'c1000000-0000-0000-0000-000000000001'),
  'activo',
  'accept_client_invitation: the client moves from invitado to activo'
);

select is(
  (select consent_version from public.clients where id = 'c1000000-0000-0000-0000-000000000001'),
  '2026-11-03-borrador',
  'accept_client_invitation: the accepted consent version is stored (I33)'
);

select isnt(
  (select consent_accepted_at from public.clients where id = 'c1000000-0000-0000-0000-000000000001'),
  null,
  'accept_client_invitation: and so is the date it was accepted'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$ update public.clients set consent_version = 'otra' where id = 'c1000000-0000-0000-0000-000000000001' $$,
  'P0001',
  'client.consent_readonly',
  'the trainer cannot rewrite the consent of a client'
);

reset role;

select is(
  (select role::text from public.profiles where user_id = 'a1000000-0000-0000-0000-000000000001'),
  'client',
  'accept_client_invitation: the profile is created with the client role'
);

select * from finish();
rollback;
