-- Status and rating move from a single scalar on places to one row per
-- (place, user): every member of a shared place rates/statuses it
-- independently. A personal place is just a "collection of one" -- the
-- owner's own row -- so this table is used uniformly, not only for shared
-- places.

create table public.place_user_status (
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  status text not null default 'want_to_go',
  rating numeric(2,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id),
  constraint place_user_status_status_valid check (status in ('visited', 'want_to_go', 'avoid')),
  constraint place_user_status_rating_valid check (rating is null or (rating >= 0.5 and rating <= 5)),
  constraint place_user_status_rating_status_valid check (status = 'visited' or rating is null)
);

create index place_user_status_user_id_idx on public.place_user_status (user_id);

alter table public.place_user_status enable row level security;

drop trigger if exists place_user_status_set_updated_at on public.place_user_status;
create trigger place_user_status_set_updated_at
before update on public.place_user_status
for each row execute function public.set_updated_at();

create policy place_user_status_select
on public.place_user_status
for select
to authenticated
using (public.can_access_place(place_id, true));

create policy place_user_status_insert
on public.place_user_status
for insert
to authenticated
with check (user_id = auth.uid() and public.can_access_place(place_id, true));

create policy place_user_status_update
on public.place_user_status
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.can_access_place(place_id, true));

create policy place_user_status_delete
on public.place_user_status
for delete
to authenticated
using (user_id = auth.uid());
