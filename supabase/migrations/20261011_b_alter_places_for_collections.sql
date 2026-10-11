-- Places can optionally belong to a shared collection. Personal places
-- (collection_id null) keep working exactly as before.

alter table public.places
  add column collection_id uuid references public.collections (id) on delete set null;

create index places_collection_id_idx on public.places (collection_id);

-- user_id becomes immutable after insert. Without this, an active (but
-- non-owning) collection member could run
--   UPDATE places SET collection_id = NULL, user_id = <themselves>
-- on a place they don't own and steal it into their personal list, because
-- WITH CHECK only looks at the new row. Pinning user_id to its original
-- value makes the OR'd policy below safe.
create or replace function public.places_lock_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists places_lock_user_id on public.places;
create trigger places_lock_user_id
before update on public.places
for each row execute function public.places_lock_user_id();

create or replace function public.can_access_place(
  p_place_id uuid,
  p_require_active_member boolean default true
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.places pl
    where pl.id = p_place_id
      and (
        pl.user_id = auth.uid()
        or (pl.collection_id is not null and public.is_collection_member(pl.collection_id, p_require_active_member))
      )
  );
$$;

grant execute on function public.can_access_place(uuid, boolean) to authenticated;

drop policy if exists places_select_own on public.places;
drop policy if exists places_insert_own on public.places;
drop policy if exists places_update_own on public.places;
drop policy if exists places_delete_own on public.places;

create policy places_select_own
on public.places
for select
to authenticated
using (
  user_id = auth.uid()
  or (collection_id is not null and public.is_collection_member(collection_id, true))
);

-- Insert has no prior row to anchor identity to, so user_id must always be
-- the caller -- stricter (AND'd) than the update check below.
create policy places_insert_own
on public.places
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (collection_id is null or public.is_collection_member(collection_id, true))
);

-- Safe to OR owner-or-member here because places_lock_user_id pins user_id
-- to its original value regardless of what the client sends.
create policy places_update_own
on public.places
for update
to authenticated
using (
  user_id = auth.uid()
  or (collection_id is not null and public.is_collection_member(collection_id, true))
)
with check (
  (collection_id is null and user_id = auth.uid())
  or (collection_id is not null and public.is_collection_member(collection_id, true))
);

create policy places_delete_own
on public.places
for delete
to authenticated
using (
  user_id = auth.uid()
  or (collection_id is not null and public.is_collection_member(collection_id, true))
);

-- place_tags: access now tracks place accessibility, not just ownership.
drop policy if exists place_tags_select_own on public.place_tags;
drop policy if exists place_tags_insert_own on public.place_tags;
drop policy if exists place_tags_update_own on public.place_tags;
drop policy if exists place_tags_delete_own on public.place_tags;

create policy place_tags_select_own
on public.place_tags
for select
to authenticated
using (public.can_access_place(place_id, true));

create policy place_tags_insert_own
on public.place_tags
for insert
to authenticated
with check (public.can_access_place(place_id, true));

create policy place_tags_update_own
on public.place_tags
for update
to authenticated
using (public.can_access_place(place_id, true))
with check (public.can_access_place(place_id, true));

create policy place_tags_delete_own
on public.place_tags
for delete
to authenticated
using (public.can_access_place(place_id, true));
