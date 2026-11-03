-- Card 124 (docs/dominio.md §4, §5, §6 and §7 Membresía, 03-11-2026).
--
-- E1: the trainer turns each of the four closed membership types on or off and gives it a price.
-- E3: prices are whole euro cents, greater than zero; no currency is stored.
-- E2, I21: a membership keeps its type and a frozen copy of the price charged, plus the id of the
-- online payment that created it. Both are null for manual registration (S6). No card or account
-- data ever reaches the database.

create table public.membership_rates (
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  type public.membership_type not null,
  active boolean not null default false,
  price_cents integer check (price_cents > 0),
  updated_at timestamptz not null default now(),
  primary key (trainer_id, type)
);

create trigger membership_rates_set_updated_at
  before update on public.membership_rates
  for each row execute function public.set_updated_at();

alter table public.membership_rates enable row level security;

create policy membership_rates_trainer_select on public.membership_rates
  for select to authenticated
  using (public.is_trainer_of(trainer_id));

create policy membership_rates_trainer_insert on public.membership_rates
  for insert to authenticated
  with check (public.is_trainer_of(trainer_id));

create policy membership_rates_trainer_update on public.membership_rates
  for update to authenticated
  using (public.is_trainer_of(trainer_id))
  with check (public.is_trainer_of(trainer_id));

-- The client reads the rates of their trainer that can be paid: active and with a price (E1, E5).
create policy membership_rates_client_select on public.membership_rates
  for select to authenticated
  using (
    public.is_active_client()
    and active
    and price_cents is not null
    and trainer_id = (select c.trainer_id from public.clients c where c.id = (select public.current_client_id()))
  );

alter table public.memberships
  add column price_cents integer check (price_cents > 0),
  add column online_payment_id text check (online_payment_id is null or length(btrim(online_payment_id)) > 0);

-- I34: the same payment never creates two memberships.
create unique index memberships_online_payment_unique on public.memberships (online_payment_id)
  where online_payment_id is not null;

-- I21, I34: only a confirmed online payment writes these two, through record_online_payment (card
-- 125), which runs as its owner. Neither the trainer nor the client writes them through the API.
create or replace function public.protect_membership_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and (
    (tg_op = 'INSERT' and (new.price_cents is not null or new.online_payment_id is not null))
    or (tg_op = 'UPDATE' and (
      new.price_cents is distinct from old.price_cents
      or new.online_payment_id is distinct from old.online_payment_id
    ))
  ) then
    raise exception 'membership.payment_readonly';
  end if;
  return new;
end;
$$;

create trigger memberships_protect_payment
  before insert or update on public.memberships
  for each row execute function public.protect_membership_payment();
