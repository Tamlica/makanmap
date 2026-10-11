-- Shared collections: multiple users collaborating on the same set of
-- places. owner_id is the single source of truth for "who can manage this
-- collection" (rename/delete/invite/remove) -- no separate role column.

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_name_not_blank check (char_length(trim(name)) > 0)
);

create index collections_owner_id_idx on public.collections (owner_id);

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

alter table public.collections enable row level security;

create table public.collection_members (
  collection_id uuid not null references public.collections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id),
  constraint collection_members_status_valid check (status in ('pending', 'active'))
);

create index collection_members_user_id_idx on public.collection_members (user_id);

alter table public.collection_members enable row level security;

-- Invoker-rights helper (not security definer): it queries collection_members
-- filtered to auth.uid(), which that table's own "own row only" select
-- policy already permits, so there is no recursive RLS evaluation.
create or replace function public.is_collection_member(
  p_collection_id uuid,
  p_require_active boolean default true
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.collection_members cm
    where cm.collection_id = p_collection_id
      and cm.user_id = auth.uid()
      and (not p_require_active or cm.status = 'active')
  );
$$;

grant execute on function public.is_collection_member(uuid, boolean) to authenticated;

-- collections: owner sees/manages everything; pending+active members can see
-- the collection (name) so an invitee knows what they're accepting.
create policy collections_select
on public.collections
for select
to authenticated
using (owner_id = auth.uid() or public.is_collection_member(id, false));

create policy collections_insert
on public.collections
for insert
to authenticated
with check (owner_id = auth.uid());

create policy collections_update
on public.collections
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy collections_delete
on public.collections
for delete
to authenticated
using (owner_id = auth.uid());

-- collection_members: intentionally minimal -- no broad select. Cross-member
-- reads go through list_collection_members() (added in a later migration).
create policy collection_members_select_own
on public.collection_members
for select
to authenticated
using (user_id = auth.uid());

-- Lets a brand-new owner insert their own active row right after creating
-- the collection (they already own the just-inserted collections row), and
-- lets the owner insert pending rows to invite others -- same policy, no
-- special case.
create policy collection_members_insert_by_owner
on public.collection_members
for insert
to authenticated
with check (
  exists (
    select 1 from public.collections c
    where c.id = collection_id and c.owner_id = auth.uid()
  )
);

create policy collection_members_update_own
on public.collection_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Covers both "I remove myself" (leave/decline) and "the owner removes me".
create policy collection_members_delete_own_or_owner
on public.collection_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.collections c
    where c.id = collection_id and c.owner_id = auth.uid()
  )
);
