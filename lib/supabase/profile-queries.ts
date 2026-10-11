import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { JournalTag, Place } from "@/lib/types/food-journal";

export type Profile = {
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  isPublic: boolean;
};

export type UpdateProfileInput = {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  isPublic?: boolean;
};

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
};

function mapProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    isPublic: row.is_public,
  };
}

function requireClient() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase env is missing.");
  }
  return supabase;
}

export async function fetchOwnProfile(): Promise<Profile | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, bio, is_public")
    .maybeSingle<ProfileRow>();

  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function updateOwnProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<Profile> {
  const supabase = requireClient();

  const patch: Partial<Omit<ProfileRow, "user_id">> = {};
  if (input.username !== undefined) patch.username = input.username;
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.isPublic !== undefined) patch.is_public = input.isPublic;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", userId)
    .select("user_id, username, display_name, bio, is_public")
    .single<ProfileRow>();

  if (error) {
    // 23505 = unique_violation on the username index.
    if (error.code === "23505") {
      throw new Error("That username is already taken.");
    }
    throw error;
  }
  return mapProfile(data);
}

export async function isUsernameAvailable(candidate: string): Promise<boolean> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc("is_username_available", {
    candidate,
  });
  if (error) throw error;
  return data !== false;
}

export type PublicJournal = {
  profile: { username: string; displayName: string | null; bio: string | null };
  places: Place[];
  tags: JournalTag[];
};

type PublicJournalPayload = {
  profile: { username: string; displayName: string | null; bio: string | null };
  places: Array<{
    id: string;
    name: string;
    status: Place["status"];
    rating: number | null;
    priceRange: number | null;
    visitDate: string | null;
    latitude: number;
    longitude: number;
    imageUrls: string[];
    tagIds: string[];
  }>;
  tags: Array<{ id: string; name: string; color: string }>;
};

/** Returns null when the username does not exist or its page is not public. */
export async function fetchPublicJournal(
  username: string
): Promise<PublicJournal | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc("get_public_journal", {
    p_username: username,
  });

  if (error) throw error;
  if (!data) return null;

  const payload = data as PublicJournalPayload;
  return {
    profile: payload.profile,
    places: payload.places.map((place) => ({
      ...place,
      notes: null,
      imageUrl: place.imageUrls[0] ?? null,
      isPublic: true,
      collectionId: null,
      memberStatuses: [],
      createdAt: "",
      updatedAt: "",
    })),
    tags: payload.tags.map((tag) => ({ ...tag, createdAt: "" })),
  };
}
