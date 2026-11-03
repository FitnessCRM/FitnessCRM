-- I31 (E10, docs/dominio.md §6 and §7, 03-11-2026): a client email is unique across the platform,
-- compared trimmed and case-insensitively, and only changes while the client is `invitado`.
--
-- The index spans every trainer, which RLS cannot see across: a duplicate fails on insert or update
-- with a unique violation, and the adapter turns it into `client.email_taken`. The lock is a trigger,
-- so it also holds for writes that bypass the app.

create unique index clients_email_unique on public.clients (lower(btrim(email)));

create or replace function public.lock_client_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(btrim(new.email)) <> lower(btrim(old.email)) and old.status <> 'invitado' then
    raise exception 'client.email_locked';
  end if;
  return new;
end;
$$;

create trigger clients_lock_email
  before update of email on public.clients
  for each row execute function public.lock_client_email();
