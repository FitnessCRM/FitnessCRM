-- Reviews and logs (Fase 2 and 3): weight logs, weekly reviews with their photos, measurements and
-- answers, and workout logs.
-- Source of truth: docs/dominio.md §2 (WeightLog, Review), §5, §6 (I5, I9, I12, I14, I16, I18, I20,
-- I22–I27), §7 (ciclos de vida) and lib/domain/schemas/{weight-log,review,workout-log}.ts.
--
-- Writes to reviews, photos, measurements and answers go through RPCs (Fase 5): opening a review
-- freezes its week and requirements, sending it checks completeness (I5), and each one touches
-- several rows. Here the policies only read them. Clients write their weight logs and their
-- workout logs directly, and only while the ficha is active (§7).

-- Weight log: continuous data, one per client and date (I23). Source of truth of the weight (I9, I24).
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null,
  log_date date not null,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg <= 400),
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint weight_logs_tenant_key unique (trainer_id, id),
  constraint weight_logs_client_key unique (client_id, id),
  constraint weight_logs_client_date_key unique (client_id, log_date),
  constraint weight_logs_client_fk foreign key (trainer_id, client_id)
    references public.clients (trainer_id, id) on delete cascade
);

-- I27: a weight log is not later than today in the trainer's time zone, nor earlier than the
-- client's start date. Runs as definer so the check reads the trainer's zone whoever writes.
create or replace function public.weight_logs_check_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_start date;
begin
  select (now() at time zone t.time_zone)::date
    into v_today
    from public.trainers t
    where t.id = new.trainer_id;

  select c.start_date
    into v_start
    from public.clients c
    where c.id = new.client_id;

  if new.log_date > v_today or new.log_date < v_start then
    raise exception 'weight log date is outside the allowed range (I27)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger weight_logs_check_date
  before insert or update on public.weight_logs
  for each row execute function public.weight_logs_check_date();

-- I25: a weight log pointed at by a sent review cannot be deleted. Drafts can lose it: the reference
-- is cleared (see reviews_weight_fk). The client's on-request erasure deletes the reviews first.
create or replace function public.weight_logs_guard_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.reviews r
    where r.weight_log_id = old.id
      and r.status <> 'borrador'
  ) then
    raise exception 'weight log belongs to a sent review (I25)'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger weight_logs_guard_delete
  before delete on public.weight_logs
  for each row execute function public.weight_logs_guard_delete();

-- Weekly review (§8, I5, I9, I16, I22, I24). Week, window and requirements are frozen when it opens.
create type public.review_status as enum ('borrador', 'enviada', 'vista', 'revisada');
create type public.review_pose as enum ('frente', 'perfil', 'espalda');

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null,
  week_number integer not null check (week_number > 0),
  window_start date not null,
  window_end date not null,
  status public.review_status not null default 'borrador',
  required_measurement_type_ids uuid[] not null default '{}',
  required_question_ids uuid[] not null default '{}',
  weight_log_id uuid,
  frozen_weight_kg numeric,
  frozen_weight_date date,
  feedback_video_url text,
  feedback_note text not null default '',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  viewed_at timestamptz,
  reviewed_at timestamptz,
  constraint reviews_tenant_key unique (trainer_id, id),
  -- I16: at most one review per client and week.
  constraint reviews_week_key unique (client_id, week_number),
  constraint reviews_client_fk foreign key (trainer_id, client_id)
    references public.clients (trainer_id, id) on delete cascade,
  -- Clears only the reference when a draft's weight log is deleted; a sent review blocks that delete.
  constraint reviews_weight_fk foreign key (client_id, weight_log_id)
    references public.weight_logs (client_id, id) on delete set null (weight_log_id),
  constraint reviews_window_check check (window_end >= window_start),
  constraint reviews_frozen_weight_range check (
    frozen_weight_kg is null or (frozen_weight_kg > 0 and frozen_weight_kg <= 400)
  ),
  -- I24: editable reviews carry no copy; sent-and-viewed ones carry it if and only if they had a weigh-in.
  constraint reviews_frozen_weight_check check (
    case
      when status in ('borrador', 'enviada')
        then frozen_weight_kg is null and frozen_weight_date is null
      else (weight_log_id is null) = (frozen_weight_kg is null)
        and (frozen_weight_kg is null) = (frozen_weight_date is null)
    end
  ),
  constraint reviews_submitted_check check (status = 'borrador' or submitted_at is not null),
  constraint reviews_viewed_check check (status not in ('vista', 'revisada') or viewed_at is not null),
  constraint reviews_reviewed_check check (status <> 'revisada' or reviewed_at is not null)
);

create index reviews_trainer_status_idx on public.reviews (trainer_id, status);

-- I22 and I5: week, window and requirements never change after the review opens.
create or replace function public.reviews_freeze_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.client_id, new.week_number, new.window_start, new.window_end,
      new.required_measurement_type_ids, new.required_question_ids)
    is distinct from
    (old.client_id, old.week_number, old.window_start, old.window_end,
      old.required_measurement_type_ids, old.required_question_ids) then
    raise exception 'week, window and requirements are frozen when the review opens (I22, I5)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger reviews_freeze_guard
  before update on public.reviews
  for each row execute function public.reviews_freeze_guard();

-- One photo per pose (ReviewMedia). The path is {trainer_id}/{client_id}/{review_id}/{uuid}.jpg, in
-- the bucket review-photos (20261028120300); the checks pin the trainer and review folders.
create table public.review_media (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  review_id uuid not null,
  pose public.review_pose not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  constraint review_media_review_pose_key unique (review_id, pose),
  constraint review_media_path_key unique (storage_path),
  constraint review_media_review_fk foreign key (trainer_id, review_id)
    references public.reviews (trainer_id, id) on delete cascade,
  constraint review_media_path_check check (
    split_part(storage_path, '/', 1) = trainer_id::text
    and split_part(storage_path, '/', 3) = review_id::text
  )
);

-- Body measurement (I8, I12). The label and unit are a frozen copy; the type stays a live reference.
create table public.review_measurements (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  review_id uuid not null,
  measurement_type_id uuid not null,
  value numeric not null,
  label text not null check (length(btrim(label)) > 0),
  unit text not null check (length(btrim(unit)) > 0),
  constraint review_measurements_review_type_key unique (review_id, measurement_type_id),
  constraint review_measurements_review_fk foreign key (trainer_id, review_id)
    references public.reviews (trainer_id, id) on delete cascade,
  constraint review_measurements_type_fk foreign key (trainer_id, measurement_type_id)
    references public.measurement_types (trainer_id, id)
);

-- I26: the first measurement of a type raises its has_measurements flag, which freezes its unit.
create or replace function public.review_measurements_flag_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.measurement_types
    set has_measurements = true
    where id = new.measurement_type_id
      and not has_measurements;
  return new;
end;
$$;

create trigger review_measurements_flag_type
  after insert on public.review_measurements
  for each row execute function public.review_measurements_flag_type();

-- Answer to a question (I12, I15). Prompt and format are a frozen copy; the value is checked against it.
create table public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  review_id uuid not null,
  question_id uuid not null,
  prompt text not null check (length(btrim(prompt)) > 0),
  format_kind public.question_format_kind not null,
  scale_min integer,
  scale_max integer,
  value_number integer,
  value_text text,
  constraint questionnaire_responses_review_question_key unique (review_id, question_id),
  constraint questionnaire_responses_review_fk foreign key (trainer_id, review_id)
    references public.reviews (trainer_id, id) on delete cascade,
  constraint questionnaire_responses_question_fk foreign key (trainer_id, question_id)
    references public.questionnaire_questions (trainer_id, id),
  constraint questionnaire_responses_value_check check (
    (format_kind = 'escala'
      and scale_min is not null and scale_max is not null
      and scale_min >= 0 and scale_max > scale_min
      and value_number is not null and value_number between scale_min and scale_max
      and value_text is null)
    or (format_kind = 'texto'
      and scale_min is null and scale_max is null
      and value_number is null and value_text is not null)
  )
);

-- I15: the first answer raises the question's has_responses flag, which freezes its format.
create or replace function public.questionnaire_responses_flag_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.questionnaire_questions
    set has_responses = true
    where id = new.question_id
      and not has_responses;
  return new;
end;
$$;

create trigger questionnaire_responses_flag_question
  after insert on public.questionnaire_responses
  for each row execute function public.questionnaire_responses_flag_question();

-- Training log: what the client actually did (WorkoutLog). Keeps the routine version and the line
-- it was done on. Lines keep their id across versions (§7), so this resolves to the right line.
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null,
  exercise_id uuid not null,
  routine_id uuid not null,
  routine_day_exercise_id uuid not null,
  log_date date not null,
  set_number integer not null check (set_number > 0),
  weight_kg numeric not null check (weight_kg >= 0),
  reps integer not null check (reps >= 0),
  created_at timestamptz not null default now(),
  constraint workout_logs_client_fk foreign key (trainer_id, client_id)
    references public.clients (trainer_id, id) on delete cascade,
  constraint workout_logs_exercise_fk foreign key (trainer_id, exercise_id)
    references public.exercises (trainer_id, id),
  constraint workout_logs_routine_fk foreign key (routine_id, client_id)
    references public.routines (id, client_id),
  constraint workout_logs_line_fk foreign key (routine_id, routine_day_exercise_id)
    references public.routine_day_exercises (routine_id, id)
);

create index workout_logs_client_date_idx on public.workout_logs (client_id, log_date);

-- Row level security.

alter table public.weight_logs enable row level security;

create policy weight_logs_trainer_select on public.weight_logs
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy weight_logs_client_select on public.weight_logs
  for select to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
  );

create policy weight_logs_client_insert on public.weight_logs
  for insert to authenticated
  with check (
    public.is_active_client()
    and client_id = (select public.current_client_id())
    and trainer_id = (select public.current_trainer_id())
  );

create policy weight_logs_client_update on public.weight_logs
  for update to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
  )
  with check (
    public.is_active_client()
    and client_id = (select public.current_client_id())
    and trainer_id = (select public.current_trainer_id())
  );

create policy weight_logs_client_delete on public.weight_logs
  for delete to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
  );

alter table public.reviews enable row level security;

-- The trainer receives reviews only once they are sent: drafts are never received (§3, §7).
create policy reviews_trainer_select on public.reviews
  for select to authenticated
  using (
    public.is_trainer_of(trainer_id)
    and status <> 'borrador'
  );

create policy reviews_client_select on public.reviews
  for select to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
  );

alter table public.review_media enable row level security;

create policy review_media_select on public.review_media
  for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_media.review_id));

alter table public.review_measurements enable row level security;

create policy review_measurements_select on public.review_measurements
  for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_measurements.review_id));

alter table public.questionnaire_responses enable row level security;

create policy questionnaire_responses_select on public.questionnaire_responses
  for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = questionnaire_responses.review_id));

alter table public.workout_logs enable row level security;

create policy workout_logs_trainer_select on public.workout_logs
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy workout_logs_client_select on public.workout_logs
  for select to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
  );

create policy workout_logs_client_insert on public.workout_logs
  for insert to authenticated
  with check (
    public.is_active_client()
    and client_id = (select public.current_client_id())
    and trainer_id = (select public.current_trainer_id())
  );

create policy workout_logs_client_update on public.workout_logs
  for update to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
  )
  with check (
    public.is_active_client()
    and client_id = (select public.current_client_id())
    and trainer_id = (select public.current_trainer_id())
  );

create policy workout_logs_client_delete on public.workout_logs
  for delete to authenticated
  using (
    public.is_active_client()
    and client_id = (select public.current_client_id())
  );

-- Clients read the exercises of their active routine and the ones they have logged (I11). The
-- trainer's library policies (rls.sql) stay as they are; these are only for the client.
create policy exercises_client_select on public.exercises
  for select to authenticated
  using (
    public.is_active_client()
    and trainer_id = (select public.current_trainer_id())
    and (
      exists (
        select 1
        from public.routine_day_exercises rde
        where rde.exercise_id = exercises.id
          and exists (select 1 from public.routines r where r.id = rde.routine_id)
      )
      or exists (
        select 1
        from public.workout_logs wl
        where wl.exercise_id = exercises.id
          and wl.client_id = (select public.current_client_id())
      )
    )
  );
