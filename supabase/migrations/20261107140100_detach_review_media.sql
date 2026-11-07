-- Card 17 (docs/dominio.md §9, «Quitar o sustituir una foto»).
--
-- The client removes the photo of a pose while the review is editable (I17), and the app then asks
-- delete-review-photos to remove its object, as it does after a replacement. This returns the path
-- that stopped being registered, or null if the pose had no photo. Same checks as
-- attach_review_media (20261028120800): only the active client who owns the review.
create or replace function public.detach_review_media(p_review_id uuid, p_pose public.review_pose)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews;
  v_removed text;
begin
  select * into v_review from public.reviews where id = p_review_id;
  if not found or not public.is_active_client() or v_review.client_id <> (select public.current_client_id()) then
    raise exception 'review.not_found';
  end if;
  if v_review.status not in ('borrador', 'enviada') then
    raise exception 'review.not_editable';
  end if;

  delete from public.review_media
    where review_id = p_review_id and pose = p_pose
    returning storage_path into v_removed;

  return v_removed;
end;
$$;

revoke execute on function public.detach_review_media(uuid, public.review_pose) from public, anon;
grant execute on function public.detach_review_media(uuid, public.review_pose) to authenticated;
