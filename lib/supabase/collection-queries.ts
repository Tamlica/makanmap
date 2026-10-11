import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Collection, CollectionMember, MembershipStatus } from "@/lib/types/food-journal";

function requireClient() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase env is missing.");
  }
  return supabase;
}

type CollectionRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  collection_members: Array<{ status: MembershipStatus }>;
};

export type MyCollection = Collection & { myStatus: MembershipStatus };

function mapCollectionRow(row: CollectionRow): MyCollection {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    myStatus: row.collection_members[0]?.status ?? "active",
  };
}

/** Owned + joined collections, including pending invites -- RLS already
 * scopes the embedded collection_members row to the caller's own. */
export async function listMyCollections(): Promise<MyCollection[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("collections")
    .select("*, collection_members(status)")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as CollectionRow[]).map(mapCollectionRow);
}

export async function createCollection(name: string): Promise<MyCollection> {
  const supabase = requireClient();

  const { data: collection, error } = await supabase
    .from("collections")
    .insert({ name })
    .select("*")
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from("collection_members")
    .insert({ collection_id: collection.id, user_id: collection.owner_id, status: "active" });
  if (memberError) throw memberError;

  return mapCollectionRow({ ...collection, collection_members: [] });
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("collections").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteCollection(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw error;
}

export async function inviteMember(collectionId: string, username: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.rpc("invite_collection_member", {
    p_collection_id: collectionId,
    p_username: username.trim().toLowerCase(),
  });
  if (error) throw error;
}

export async function listCollectionMembers(collectionId: string): Promise<CollectionMember[]> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc("list_collection_members", {
    p_collection_id: collectionId,
  });
  if (error) throw error;

  return ((data ?? []) as Array<{
    user_id: string;
    username: string;
    display_name: string | null;
    status: MembershipStatus;
  }>).map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    status: row.status,
  }));
}

export async function removeMember(collectionId: string, userId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("collection_members")
    .delete()
    .eq("collection_id", collectionId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function acceptInvite(collectionId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("collection_members")
    .update({ status: "active" })
    .eq("collection_id", collectionId);
  if (error) throw error;
}

/** Declining a pending invite and leaving an accepted collection are both
 * just "remove my own membership row" -- RLS scopes the delete either way. */
export async function leaveCollection(collectionId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("collection_members")
    .delete()
    .eq("collection_id", collectionId);
  if (error) throw error;
}

export const declineInvite = leaveCollection;
