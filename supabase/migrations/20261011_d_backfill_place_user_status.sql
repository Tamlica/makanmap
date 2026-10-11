-- Backfill: one place_user_status row per existing place, keyed by its
-- current owner. Verify row counts match places before applying the next
-- migration, which drops the old columns.

insert into public.place_user_status (place_id, user_id, status, rating, created_at, updated_at)
select id, user_id, status, rating, created_at, updated_at
from public.places
on conflict (place_id, user_id) do nothing;
