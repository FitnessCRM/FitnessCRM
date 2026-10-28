-- Review photos bucket (Fase 4). Private, with size and MIME limits, and policies that tie each
-- object to the tenant and client in its path: {trainer_id}/{client_id}/{review_id}/{uuid}.jpg
--
-- The client uploads their own photos during a review. The trainer reads photos of their
-- tenant. Deletion is not granted to any user: an Edge Function with the service role removes
-- objects after the SQL function returns their paths (Fase 4.5).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos',
  'review-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Client uploads only into their own folder: trainer and client segments must match the claims.
create policy review_photos_client_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'review-photos'
    and (select public.current_user_role()) = 'client'
    and (storage.foldername(name))[1] = (select public.current_trainer_id())::text
    and (storage.foldername(name))[2] = (select public.current_client_id())::text
  );

-- Trainer reads photos of their own tenant.
create policy review_photos_trainer_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'review-photos'
    and (select public.current_user_role()) = 'trainer'
    and (storage.foldername(name))[1] = (select public.current_trainer_id())::text
  );

-- Client reads their own photos (the app uses signed URLs; this covers direct reads).
create policy review_photos_client_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'review-photos'
    and (select public.current_user_role()) = 'client'
    and (storage.foldername(name))[1] = (select public.current_trainer_id())::text
    and (storage.foldername(name))[2] = (select public.current_client_id())::text
  );

-- No update or delete policies: objects are removed only by the service role (Edge Function).
