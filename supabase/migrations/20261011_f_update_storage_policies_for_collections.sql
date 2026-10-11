-- Place-image storage access now tracks place accessibility (owner or
-- active collection member) instead of just the uploader's own folder, so
-- collection-mates can manage each other's photos for shared places.
-- Upload path stays places/<uploaderId>/<placeId>/<uuid>.<ext>; segment [2]
-- (uploader id) is kept on insert only, to avoid filename collisions -- it
-- is no longer the authorization check.

drop policy if exists place_images_insert on storage.objects;
create policy place_images_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'place-images'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_access_place(((storage.foldername(name))[3])::uuid, true)
);

drop policy if exists place_images_update on storage.objects;
create policy place_images_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'place-images'
  and public.can_access_place(((storage.foldername(name))[3])::uuid, true)
)
with check (
  bucket_id = 'place-images'
  and public.can_access_place(((storage.foldername(name))[3])::uuid, true)
);

drop policy if exists place_images_delete on storage.objects;
create policy place_images_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'place-images'
  and public.can_access_place(((storage.foldername(name))[3])::uuid, true)
);

drop policy if exists "place_images_select" on storage.objects;
drop policy if exists place_images_select on storage.objects;
create policy place_images_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'place-images'
  and public.can_access_place(((storage.foldername(name))[3])::uuid, true)
);
