-- Fase 5, second part: membership renewals and catalog archiving. Same rules as
-- 20261028120800_rpc.sql: security definer, the caller checked with the policy helpers, and business
-- errors raised with the domain code as the message.

-- Renewal (§7, I21): a new row, never an edit of the previous one. The end is one period of the type
-- after the start, minus one day, with the rule of membershipEndDate (lib/domain/membership.ts): the day
-- of the month is kept, or clamped to the last day of a shorter month. Overlaps are allowed; the domain
-- reports them.
create or replace function public.renew_membership(
  p_client_id uuid,
  p_type public.membership_type,
  p_start_date date,
  p_payment_status public.payment_status
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
  v_months integer;
  v_new uuid;
begin
  if not public.is_writable_client(p_client_id) then
    raise exception 'client.not_writable';
  end if;

  select c.trainer_id into v_trainer from public.clients c where c.id = p_client_id;

  v_months := case p_type
    when 'mensual' then 1
    when 'trimestral' then 3
    when 'semestral' then 6
    when 'anual' then 12
  end;

  insert into public.memberships (trainer_id, client_id, type, start_date, end_date, payment_status)
    values (v_trainer, p_client_id, p_type, p_start_date,
      (p_start_date + make_interval(months => v_months))::date - 1, p_payment_status)
    returning id into v_new;

  return v_new;
end;
$$;

-- Archiving never deletes (I13). A food leaves the library; menus that already use it keep their
-- frozen copy (I29), so nothing else changes.
create or replace function public.archive_food(p_food_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
begin
  select f.trainer_id into v_trainer from public.foods f where f.id = p_food_id;
  if not found or not public.is_trainer_of(v_trainer) then
    raise exception 'food.not_found';
  end if;

  update public.foods set status = 'archivado' where id = p_food_id;
end;
$$;

-- Archiving a measurement type or a question keeps the answers already recorded (I12, I26): the frozen
-- copies stay in the reviews, and the type or question only leaves the catalog for the next reviews.
create or replace function public.archive_measurement_type(p_measurement_type_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
begin
  select t.trainer_id into v_trainer from public.measurement_types t where t.id = p_measurement_type_id;
  if not found or not public.is_trainer_of(v_trainer) then
    raise exception 'measurement_type.not_found';
  end if;

  update public.measurement_types set status = 'archivada' where id = p_measurement_type_id;
end;
$$;

create or replace function public.archive_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
begin
  select q.trainer_id into v_trainer from public.questionnaire_questions q where q.id = p_question_id;
  if not found or not public.is_trainer_of(v_trainer) then
    raise exception 'question.not_found';
  end if;

  update public.questionnaire_questions set status = 'archivada' where id = p_question_id;
end;
$$;

-- Grants: the RPC run for the signed-in role only, as in 20261028120800_rpc.sql.
revoke execute on function public.renew_membership(uuid, public.membership_type, date, public.payment_status) from public, anon;
revoke execute on function public.archive_food(uuid) from public, anon;
revoke execute on function public.archive_measurement_type(uuid) from public, anon;
revoke execute on function public.archive_question(uuid) from public, anon;

grant execute on function public.renew_membership(uuid, public.membership_type, date, public.payment_status) to authenticated;
grant execute on function public.archive_food(uuid) to authenticated;
grant execute on function public.archive_measurement_type(uuid) to authenticated;
grant execute on function public.archive_question(uuid) to authenticated;
