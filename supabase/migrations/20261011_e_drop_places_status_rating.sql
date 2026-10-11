-- Contract step: drop the old scalar status/rating columns now that
-- place_user_status has been backfilled (previous migration). Rewritten in
-- the same migration as get_public_journal below, which read those columns
-- directly -- never leave a gap where it references dropped columns.

alter table public.places drop constraint if exists places_status_valid;
alter table public.places drop constraint if exists places_rating_valid;
alter table public.places drop constraint if exists places_rating_status_valid;
drop index if exists public.places_status_idx;
drop index if exists public.places_rating_idx;
alter table public.places drop column if exists status;
alter table public.places drop column if exists rating;

-- Public showcase now reads status/rating from place_user_status, and
-- deliberately excludes places that belong to a shared collection -- a
-- collaboratively-owned place showing up as "my solo review" on a public
-- page isn't something anyone asked for, and it would leak the existence of
-- other members.
create or replace function public.get_public_journal(p_username text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_result jsonb;
begin
  select * into v_profile
  from public.profiles
  where username = lower(p_username)
    and is_public;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'username', v_profile.username,
      'displayName', v_profile.display_name,
      'bio', v_profile.bio
    ),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'status', pus.status,
        'rating', pus.rating,
        'priceRange', p.price_range,
        'visitDate', p.visit_date,
        'latitude', p.latitude,
        'longitude', p.longitude,
        'imageUrls', coalesce(to_jsonb(p.image_urls), '[]'::jsonb),
        'tagIds', coalesce((
          select jsonb_agg(pt.tag_id)
          from public.place_tags pt
          where pt.place_id = p.id
        ), '[]'::jsonb)
      ) order by p.updated_at desc)
      from public.places p
      join public.place_user_status pus
        on pus.place_id = p.id and pus.user_id = v_profile.user_id
      where p.user_id = v_profile.user_id
        and p.is_public
        and p.collection_id is null
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'color', t.color
      ))
      from public.tags t
      where t.id in (
        select pt.tag_id
        from public.place_tags pt
        join public.places p on p.id = pt.place_id
        where p.user_id = v_profile.user_id
          and p.is_public
          and p.collection_id is null
      )
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_public_journal(text) from public;
grant execute on function public.get_public_journal(text) to anon, authenticated;
