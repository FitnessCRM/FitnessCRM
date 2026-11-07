begin;

select plan(16);

-- Card 136: security definer trigger functions are not callable by anyone signed in or not, and the
-- triggers still do their job.

-- 1. Privileges. The last check covers any trigger function a later migration adds.
select ok(
  not has_function_privilege('anon', 'public.weight_logs_check_date()', 'execute')
    and not has_function_privilege('authenticated', 'public.weight_logs_check_date()', 'execute'),
  'anon and authenticated cannot execute weight_logs_check_date'
);
select ok(
  not has_function_privilege('anon', 'public.weight_logs_guard_delete()', 'execute')
    and not has_function_privilege('authenticated', 'public.weight_logs_guard_delete()', 'execute'),
  'anon and authenticated cannot execute weight_logs_guard_delete'
);
select ok(
  not has_function_privilege('anon', 'public.questionnaire_responses_flag_question()', 'execute')
    and not has_function_privilege('authenticated', 'public.questionnaire_responses_flag_question()', 'execute'),
  'anon and authenticated cannot execute questionnaire_responses_flag_question'
);
select ok(
  not has_function_privilege('anon', 'public.review_measurements_flag_type()', 'execute')
    and not has_function_privilege('authenticated', 'public.review_measurements_flag_type()', 'execute'),
  'anon and authenticated cannot execute review_measurements_flag_type'
);
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype
      and a.privilege_type = 'EXECUTE' and a.grantee = 0),
  0,
  'no security definer trigger function in public is executable by PUBLIC'
);
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute'))),
  0,
  'no security definer trigger function in public is executable by anon or authenticated'
);

-- Fixtures, as the owner.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local');

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid');

insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', '2026-01-05', 7, 'activo');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.measurement_types (id, trainer_id, label, unit, sort_order) values
  ('3e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cintura', 'cm', 0);

insert into public.questionnaire_questions (id, trainer_id, prompt, format_kind, scale_min, scale_max, sort_order) values
  ('4e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sueño', 'escala', 0, 10, 0);

insert into public.weight_logs (id, trainer_id, client_id, log_date, weight_kg) values
  ('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-02-03', 80.0);

-- rv1 is sent and points at the weigh-in; rv2 is a draft for the flag triggers.
insert into public.reviews (id, trainer_id, client_id, week_number, window_start, window_end, status, weight_log_id, submitted_at) values
  ('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '2026-02-01', '2026-02-07', 'enviada', '77777777-7777-7777-7777-777777777701', now()),
  ('88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '2026-02-08', '2026-02-14', 'borrador', null, null);

-- 2. Called through /rest/v1/rpc, as PostgREST would: refused for lack of privilege.
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select throws_ok(
  'select public.weight_logs_check_date()',
  '42501',
  null,
  'anon cannot call weight_logs_check_date'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select throws_ok(
  'select public.weight_logs_guard_delete()',
  '42501',
  null,
  'a signed-in user cannot call weight_logs_guard_delete'
);
select throws_ok(
  'select public.review_measurements_flag_type()',
  '42501',
  null,
  'a signed-in user cannot call review_measurements_flag_type'
);
select throws_ok(
  'select public.questionnaire_responses_flag_question()',
  '42501',
  null,
  'a signed-in user cannot call questionnaire_responses_flag_question'
);

-- 3. The triggers still fire for the client.
select throws_ok(
  $$insert into public.weight_logs (trainer_id, client_id, log_date, weight_kg) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (now() at time zone 'Europe/Madrid')::date + 1, 79.9)$$,
  '23514',
  null,
  'a weight dated in the future is still refused (I27)'
);
select lives_ok(
  $$insert into public.weight_logs (trainer_id, client_id, log_date, weight_kg) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-02-10', 79.9)$$,
  'a weight dated inside the range is still accepted'
);
select throws_ok(
  $$delete from public.weight_logs where id = '77777777-7777-7777-7777-777777777701'$$,
  '23514',
  null,
  'a weigh-in of a sent review still cannot be deleted (I25)'
);
select lives_ok(
  $$select public.save_review_draft('88888888-8888-8888-8888-888888888802', '{
      "measurements": [{"measurementTypeId": "3e000000-0000-0000-0000-000000000001", "value": 80}],
      "responses": [{"questionId": "4e000000-0000-0000-0000-000000000001", "value": 7}]
    }'::jsonb)$$,
  'the client saves a measurement and an answer'
);

reset role;

select ok(
  (select has_measurements from public.measurement_types where id = '3e000000-0000-0000-0000-000000000001'),
  'review_measurements_flag_type still flags the measurement type'
);
select ok(
  (select has_responses from public.questionnaire_questions where id = '4e000000-0000-0000-0000-000000000001'),
  'questionnaire_responses_flag_question still flags the question'
);

select * from finish();

rollback;
