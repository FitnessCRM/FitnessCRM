-- Card 127 (docs/dominio.md §4 and §7 Membresía, decided by Dani on 03-11-2026).
--
-- A manual registration (S6) now stores the price charged: the form proposes the current price of
-- the rate of that type and the trainer can change it, or leave it empty. It is the frozen copy of
-- the price charged (E2), in whole cents (E3), written once when the row is created.
--
-- What stays as card 124 left it (I21, I34): only a confirmed online payment, through
-- record_online_payment, writes `online_payment_id`, and nobody changes `price_cents` or
-- `online_payment_id` of an existing row through the API.
create or replace function public.protect_membership_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and (
    (tg_op = 'INSERT' and new.online_payment_id is not null)
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
