-- E12 (docs/dominio.md §6, I11, 03-11-2026; card 123): with macros_visible false, the database does
-- not send the client the declared kcal and macros of a menu. menus_client_select let them through:
-- RLS filters rows, not columns, and the trainer and the client are the same database role.
--
-- So the four macro columns are no longer selectable on the table by `authenticated`, and menus are
-- read through `menu_reads`: the same rows each one could read before (the trainer, their own; the
-- client, their active menus while active), with the macros set to null for a client whose
-- macros_visible is false. The view runs as its owner, so it repeats the row filter itself. Writes do
-- not change: they go through the functions, which run as their owner, or insert without returning.

create view public.menu_reads
with (security_barrier = true)
as
select
  m.id,
  m.trainer_id,
  m.client_id,
  m.status,
  m.name,
  m.day_type,
  m.suggested,
  case when public.is_trainer_of(m.trainer_id) or c.macros_visible then m.kcal end as kcal,
  case when public.is_trainer_of(m.trainer_id) or c.macros_visible then m.protein_g end as protein_g,
  case when public.is_trainer_of(m.trainer_id) or c.macros_visible then m.carbs_g end as carbs_g,
  case when public.is_trainer_of(m.trainer_id) or c.macros_visible then m.fat_g end as fat_g,
  m.note,
  m.source_template_name,
  m.source_template_id,
  m.created_at,
  m.updated_at
from public.menus m
join public.clients c on c.id = m.client_id
where public.is_trainer_of(m.trainer_id)
  or (
    public.is_active_client()
    and m.client_id = (select public.current_client_id())
    and m.status = 'activo'
  );

revoke all on public.menu_reads from public, anon;
grant select on public.menu_reads to authenticated;

-- The table keeps its row policies (meals and menu_items read through them), minus the four columns.
revoke select on public.menus from authenticated;
grant select (
  id, trainer_id, client_id, status, name, day_type, suggested, note,
  source_template_name, source_template_id, created_at, updated_at
) on public.menus to authenticated;
