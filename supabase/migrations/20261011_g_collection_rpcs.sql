-- Everything else (create/rename/delete collection, accept/decline/leave,
-- remove member) is a plain RLS-scoped insert/update/delete from the
-- client -- no RPC needed. Only these two genuinely need to bypass
-- profiles' owner-only RLS to resolve or display another user's identity.

create or replace function public.invite_collection_member(p_collection_id uuid, p_username text)
returns public.collection_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_target_user_id uuid;
  v_row public.collection_members;
begin
  select owner_id into v_owner_id from public.collections where id = p_collection_id;
  if v_owner_id is null then
    raise exception 'Collection not found';
  end if;
  if v_owner_id <> auth.uid() then
    raise exception 'Only the collection owner can invite members';
  end if;

  select user_id into v_target_user_id from public.profiles where username = lower(p_username);
  if v_target_user_id is null then
    raise exception 'No user found with that username';
  end if;
  if v_target_user_id = v_owner_id then
    raise exception 'You already own this collection';
  end if;

  insert into public.collection_members (collection_id, user_id, status)
  values (p_collection_id, v_target_user_id, 'pending')
  on conflict (collection_id, user_id) do nothing
  returning * into v_row;

  if v_row is null then
    raise exception 'That user is already invited or a member';
  end if;

  return v_row;
end;
$$;

revoke all on function public.invite_collection_member(uuid, text) from public;
grant execute on function public.invite_collection_member(uuid, text) to authenticated;

create or replace function public.list_collection_members(p_collection_id uuid)
returns table (user_id uuid, username text, display_name text, status text)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.collections c
    where c.id = p_collection_id
      and (c.owner_id = auth.uid() or public.is_collection_member(p_collection_id, true))
  ) then
    raise exception 'Not authorized to view this collection''s members';
  end if;

  return query
    select cm.user_id, p.username, p.display_name, cm.status
    from public.collection_members cm
    join public.profiles p on p.user_id = cm.user_id
    where cm.collection_id = p_collection_id
    order by cm.created_at asc;
end;
$$;

revoke all on function public.list_collection_members(uuid) from public;
grant execute on function public.list_collection_members(uuid) to authenticated;
