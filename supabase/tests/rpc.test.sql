begin;

select plan(44);

-- Fixtures: two trainers, one client of each, one exercise, two routines (one active, one draft) that
-- share a line, a measurement type and a question for the review.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'client-a1@test.local');

insert into auth.users (id, email, email_confirmed_at) values
  ('55555555-5555-5555-5555-555555555555', 'nueva@test.local', now());

insert into public.trainers (id, name, email, time_zone) values
  ('11111111-1111-1111-1111-111111111111', 'Entrenador A', 'trainer-a@test.local', 'Europe/Madrid'),
  ('33333333-3333-3333-3333-333333333333', 'Entrenador B', 'trainer-b@test.local', 'Europe/Madrid');

-- The client starts today in the trainer zone, so the first review week is the current one.
insert into public.clients (id, trainer_id, first_name, last_name, email, start_date, review_every_days, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marta', 'A', 'marta@test.local', (now() at time zone 'Europe/Madrid')::date, 7, 'activo'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Ajena', 'B', 'ajena@test.local', (now() at time zone 'Europe/Madrid')::date, 7, 'activo');

insert into public.profiles (user_id, role, trainer_id, client_id) values
  ('22222222-2222-2222-2222-222222222222', 'client', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.exercises (id, trainer_id, name) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Sentadilla'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '11111111-1111-1111-1111-111111111111', 'Press');

insert into public.routines (id, trainer_id, client_id, status, name) values
  ('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'activo', 'Rutina activa'),
  ('10000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'borrador', 'Rutina borrador');

insert into public.routine_days (routine_id, id, trainer_id, position, day_number) values
  ('10000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 0, 1),
  ('10000000-0000-0000-0000-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddd02', '11111111-1111-1111-1111-111111111111', 0, 1);

insert into public.routine_day_exercises (routine_id, id, routine_day_id, trainer_id, exercise_id, position, sets, reps_min) values
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 0, 3, 8),
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 1, 3, 10),
  ('10000000-0000-0000-0000-000000000002', '1c000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd02', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 0, 3, 8);

insert into public.measurement_types (id, trainer_id, label, unit, sort_order) values
  ('3e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cintura', 'cm', 0);

insert into public.questionnaire_questions (id, trainer_id, prompt, format_kind, scale_min, scale_max, sort_order) values
  ('4e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sueno', 'escala', 0, 10, 0);

insert into public.trainer_invitations (email, name, time_zone) values
  ('nueva@test.local', 'Nueva', 'Europe/Madrid');

-- Routines: a revision is a new draft with the same ids; only an active routine can be revised (§7).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$select public.revise_routine('10000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'routine.not_active',
  'only an active routine can be revised'
);

select set_config('test.revision', public.revise_routine('10000000-0000-0000-0000-000000000001')::text, true);

reset role;

select is(
  (select status::text from public.routines where id = current_setting('test.revision')::uuid),
  'borrador',
  'a revision starts as a draft'
);

select is(
  (select count(*)::int from public.routine_day_exercises where routine_id = current_setting('test.revision')::uuid),
  2,
  'the revision copies every line of the routine'
);

select ok(
  exists (select 1 from public.routine_day_exercises where routine_id = current_setting('test.revision')::uuid and id = '1c000000-0000-0000-0000-000000000001'),
  'the revision keeps the id of each line (§7)'
);

select is(
  (select count(*)::int from public.routine_day_exercises where routine_id = '10000000-0000-0000-0000-000000000001'),
  2,
  'the active routine is not edited by a revision'
);

-- Activation archives the previous active routine of the client (I4).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$select public.activate_routine('10000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'routine.not_draft',
  'only a draft can be activated'
);

select lives_ok(
  $$select public.activate_routine(current_setting('test.revision')::uuid)$$,
  'a draft revision can be activated'
);

reset role;

select is(
  (select status::text from public.routines where id = '10000000-0000-0000-0000-000000000001'),
  'archivado',
  'activating a routine archives the previous active one (I4)'
);

select is(
  (select status::text from public.routines where id = current_setting('test.revision')::uuid),
  'activo',
  'the revision is the active routine now'
);

-- The copy helper checks nothing, so a signed-in role cannot call it directly.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$select public.clone_routine('10000000-0000-0000-0000-000000000001', null)$$,
  '42501',
  null,
  'the copy helper is not callable by a signed-in role'
);

-- Archiving an exercise: the active routine becomes a new version without its line, the draft loses
-- the line in place, and the archived history keeps it (§5, §7).
select set_config(
  'test.affected',
  array_to_string(public.archive_exercise('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'), ','),
  true
);

reset role;

select is(
  current_setting('test.affected'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'archiving an exercise reports the client whose routines it changed'
);

select is(
  (select count(*)::int from public.routine_day_exercises rde
    join public.routines r on r.id = rde.routine_id
    where r.status = 'activo' and rde.exercise_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  0,
  'the active routine no longer has the archived exercise'
);

select is(
  (select count(*)::int from public.routine_day_exercises
    where routine_id = '10000000-0000-0000-0000-000000000001' and exercise_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'the archived version keeps its line, so the history still resolves'
);

select is(
  (select count(*)::int from public.routine_day_exercises
    where routine_id = '10000000-0000-0000-0000-000000000002' and exercise_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  0,
  'a draft loses the line in place'
);

select is(
  (select status::text from public.exercises where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'archivado',
  'the exercise is archived, not deleted (I13)'
);

-- Macro targets: a new active target archives the previous one of the same day type (I4).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select set_config('test.target1', public.set_macro_targets('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'entrenamiento', 2300, 160, 250, 70)::text, true);
select set_config('test.target2', public.set_macro_targets('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'entrenamiento', 2200, 160, 230, 70)::text, true);

reset role;

select is(
  (select status::text from public.macro_targets where id = current_setting('test.target1')::uuid),
  'archivado',
  'a new macro target archives the previous one (I4)'
);

select is(
  (select status::text from public.macro_targets where id = current_setting('test.target2')::uuid),
  'activo',
  'the new macro target is the active one'
);

-- macrosVisible: the client changes only their own ficha (I11).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select lives_ok(
  $$select public.set_macros_visible('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false)$$,
  'a client sets macrosVisible on their own ficha'
);

select throws_ok(
  $$select public.set_macros_visible('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false)$$,
  'P0001',
  'client.not_writable',
  'a client cannot set macrosVisible on another client'
);

reset role;

select is(
  (select macros_visible from public.clients where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  false,
  'macrosVisible is saved as the client set it'
);

-- Review: opening the current week is idempotent, and the requirements are frozen (I16, I22, I5).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select set_config('test.review', public.open_current_review()::text, true);
select set_config('test.review_again', public.open_current_review()::text, true);

select throws_ok(
  $$select public.save_review_draft(current_setting('test.review')::uuid, '{"measurements":[{"measurementTypeId":"3e000000-0000-0000-0000-0000000000ff","value":82}]}'::jsonb)$$,
  'P0001',
  'measurement.unknown_type',
  'a measurement must belong to the trainer catalog'
);

select lives_ok(
  $$select public.save_review_draft(current_setting('test.review')::uuid, '{"measurements":[{"measurementTypeId":"3e000000-0000-0000-0000-000000000001","value":82}],"responses":[{"questionId":"4e000000-0000-0000-0000-000000000001","value":7}]}'::jsonb)$$,
  'a client saves the draft of the review'
);

reset role;

select is(
  current_setting('test.review_again'),
  current_setting('test.review'),
  'opening the week twice returns the same review (I16)'
);

select is(
  (select week_number from public.reviews where id = current_setting('test.review')::uuid),
  1,
  'the first review is week 1 of the client'
);

select is(
  (select cardinality(required_measurement_type_ids) from public.reviews where id = current_setting('test.review')::uuid),
  1,
  'the review freezes the measurement types it asks for (I5)'
);

select is(
  (select label || ' ' || unit from public.review_measurements where review_id = current_setting('test.review')::uuid),
  'Cintura cm',
  'a measurement keeps the frozen label and unit (I12)'
);

select is(
  (select value_number from public.questionnaire_responses where review_id = current_setting('test.review')::uuid),
  7,
  'an answer keeps the frozen value (I12)'
);

-- Completeness only reports (I5). The client reads it while drafting; a trainer only once it is sent (§3).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select set_config('test.completeness', public.review_completeness(current_setting('test.review')::uuid)::text, true);

set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select throws_ok(
  $$select public.review_completeness(current_setting('test.review')::uuid)$$,
  'P0001',
  'review.not_found',
  'a trainer does not read the completeness of a draft'
);

set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","user_role":"trainer","trainer_id":"33333333-3333-3333-3333-333333333333"}';

select throws_ok(
  $$select public.review_completeness(current_setting('test.review')::uuid)$$,
  'P0001',
  'review.not_found',
  'a trainer cannot read the completeness of another trainer review'
);

reset role;

select is(
  current_setting('test.completeness')::jsonb ->> 'complete',
  'false',
  'a review without photos or weight is reported as incomplete, not blocked'
);

-- Photos: the object has to sit in the folder of the client, and a new photo replaces the pose (ReviewMedia).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"client","trainer_id":"11111111-1111-1111-1111-111111111111","client_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select throws_ok(
  $$select public.attach_review_media(current_setting('test.review')::uuid, 'frente', '11111111-1111-1111-1111-111111111111/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/' || current_setting('test.review') || '/frente.jpg')$$,
  'P0001',
  'media.wrong_folder',
  'a photo must sit in the folder of the client'
);

select lives_ok(
  $$select public.attach_review_media(current_setting('test.review')::uuid, 'frente', '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/' || current_setting('test.review') || '/frente.jpg')$$,
  'a client attaches the front photo'
);

select set_config(
  'test.replaced',
  public.attach_review_media(current_setting('test.review')::uuid, 'frente', '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/' || current_setting('test.review') || '/frente-2.jpg'),
  true
);

select lives_ok(
  $$select public.submit_review(current_setting('test.review')::uuid)$$,
  'the client sends the review'
);

reset role;

select is(
  current_setting('test.replaced'),
  '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/' || current_setting('test.review') || '/frente.jpg',
  'a new front photo returns the path it replaced'
);

select is(
  (select status::text from public.reviews where id = current_setting('test.review')::uuid),
  'enviada',
  'a sent review is enviada'
);

-- Feedback: viewed, then the trainer sends the feedback with an http(s) video link (I20, I24).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"trainer","trainer_id":"11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$select public.mark_review_viewed(current_setting('test.review')::uuid)$$,
  'the trainer opens the sent review'
);

select throws_ok(
  $$select public.send_review_feedback(current_setting('test.review')::uuid, 'ftp://video.test/x', 'Buen trabajo')$$,
  'P0001',
  'review.feedback_invalid_url',
  'the feedback video must be an http(s) link (I20)'
);

select lives_ok(
  $$select public.send_review_feedback(current_setting('test.review')::uuid, 'https://video.test/x', 'Buen trabajo')$$,
  'the trainer sends the feedback'
);

reset role;

select is(
  (select status::text from public.reviews where id = current_setting('test.review')::uuid),
  'revisada',
  'the review is revisada once the feedback is sent'
);

select throws_ok(
  $$update public.reviews set feedback_video_url = 'javascript:alert(1)' where id = current_setting('test.review')::uuid$$,
  '23514',
  null,
  'the database refuses a feedback link that is not http(s) either (I20)'
);

-- Invitations: a verified account accepts the invitation once and becomes a trainer (§12).
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"55555555-5555-5555-5555-555555555555","email":"nueva@test.local"}';

select set_config('test.newtrainer', public.accept_trainer_invitation()::text, true);

select throws_ok(
  $$select public.accept_trainer_invitation()$$,
  'P0001',
  'invitation.already_registered',
  'an account that already has a profile cannot accept again'
);

reset role;

select is(
  current_setting('test.newtrainer'),
  '55555555-5555-5555-5555-555555555555',
  'the invited account becomes a trainer with its own id'
);

select is(
  (select status::text from public.trainer_invitations where email = 'nueva@test.local'),
  'aceptada',
  'the invitation is marked accepted'
);

select is(
  (select role::text from public.profiles where user_id = '55555555-5555-5555-5555-555555555555'),
  'trainer',
  'the new account gets the trainer role'
);

select * from finish();

rollback;
