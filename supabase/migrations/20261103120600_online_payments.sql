-- Card 125 (docs/dominio.md §7 Membresía, §10 and §12 «Cobro de membresías con Stripe», 03-11-2026).
--
-- S5: Stripe Connect with Standard accounts and direct charges; the trainer is the merchant. The
-- connected account id is the only Stripe data the database keeps about a trainer, and only the
-- Edge Functions read or write it (service role): no policy lets anyone signed in near it.
-- S2, I21: of a payment the database keeps the id, the status (the membership is `pagada`) and the
-- amount, in the membership the confirmed payment creates. Never card or bank data.
-- E6, I34, S10: the membership is created only by the webhook, once the payment is confirmed, and the
-- same payment twice creates one membership.

create table public.trainer_payment_accounts (
  trainer_id uuid primary key references public.trainers (id) on delete cascade,
  stripe_account_id text not null unique check (length(btrim(stripe_account_id)) > 0),
  charges_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger trainer_payment_accounts_set_updated_at
  before update on public.trainer_payment_accounts
  for each row execute function public.set_updated_at();

alter table public.trainer_payment_accounts enable row level security;
-- No policies: only the service role (Edge Functions) reads and writes this table.

-- Whether a trainer can be paid online (E5). The trainer asks about themselves; a client, about their
-- trainer while active. Anyone else gets `connected = false`, as if there were no account.
create or replace function public.online_payment_status(p_trainer_id uuid)
returns table (connected boolean, enabled boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_trainer_of(p_trainer_id)
    or (
      public.is_active_client()
      and exists (
        select 1 from public.clients c
        where c.id = (select public.current_client_id()) and c.trainer_id = p_trainer_id
      )
    )
  ) then
    return query select false, false;
    return;
  end if;
  return query
    select true, a.charges_enabled from public.trainer_payment_accounts a where a.trainer_id = p_trainer_id
    union all
    select false, false
    where not exists (select 1 from public.trainer_payment_accounts a where a.trainer_id = p_trainer_id);
end;
$$;

-- The membership a confirmed payment creates (E2, E4, E6, I21, I34). Called only by the webhook, with
-- the service role. Idempotent: a payment already recorded returns its membership and creates nothing.
-- The payment must come from the connected account of the client's trainer.
create or replace function public.record_online_payment(
  p_payment_id text,
  p_stripe_account_id text,
  p_client_id uuid,
  p_type public.membership_type,
  p_amount_cents integer,
  p_paid_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
  v_client public.clients;
  v_tz text;
  v_paid_on date;
  v_current_end date;
  v_start date;
  v_months integer;
  v_id uuid;
begin
  select id into v_existing from public.memberships where online_payment_id = p_payment_id;
  if found then
    return v_existing;
  end if;

  select * into v_client from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'payment.client_not_found';
  end if;
  if not exists (
    select 1 from public.trainer_payment_accounts a
    where a.trainer_id = v_client.trainer_id and a.stripe_account_id = p_stripe_account_id
  ) then
    raise exception 'payment.account_mismatch';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'payment.invalid_amount';
  end if;

  -- The day of the payment in the trainer's zone (§8: the zone is the trainer's setting).
  select time_zone into v_tz from public.trainers where id = v_client.trainer_id;
  v_paid_on := (p_paid_at at time zone v_tz)::date;

  -- E4: the day after the membership in force that day, if any (the latest one to start); else that day.
  select m.end_date into v_current_end
    from public.memberships m
    where m.client_id = v_client.id and m.start_date <= v_paid_on and m.end_date >= v_paid_on
    order by m.start_date desc, m.created_at desc
    limit 1;
  v_start := coalesce(v_current_end + 1, v_paid_on);

  v_months := case p_type when 'mensual' then 1 when 'trimestral' then 3 when 'semestral' then 6 else 12 end;

  insert into public.memberships (
    trainer_id, client_id, type, start_date, end_date, payment_status, price_cents, online_payment_id
  ) values (
    v_client.trainer_id, v_client.id, p_type, v_start,
    (v_start + make_interval(months => v_months))::date - 1,
    'pagada', p_amount_cents, p_payment_id
  )
  on conflict (online_payment_id) where online_payment_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.memberships where online_payment_id = p_payment_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.online_payment_status(uuid) from public, anon;
grant execute on function public.online_payment_status(uuid) to authenticated;
revoke all on function public.record_online_payment(text, text, uuid, public.membership_type, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_online_payment(text, text, uuid, public.membership_type, integer, timestamptz)
  to service_role;
