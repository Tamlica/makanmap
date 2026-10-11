import type {
  CreatePlaceInput,
  JournalTag,
  Place,
  UpdatePlaceInput,
} from "@/lib/types/food-journal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const PLACE_SELECT = "*, place_tags(tag_id), place_user_status(user_id, status, rating)";

type PlaceUserStatusRow = {
  user_id: string;
  status: Place["status"];
  rating: number | null;
};

type PlaceRow = {
  id: string;
  name: string;
  notes: string | null;
  price_range: number | null;
  visit_date: string | null;
  latitude: number;
  longitude: number;
  image_urls?: string[] | null;
  image_url?: string | null;
  is_public?: boolean | null;
  collection_id: string | null;
  created_at: string;
  updated_at: string;
  place_tags?: Array<{ tag_id: string }>;
  place_user_status?: PlaceUserStatusRow[];
};

type TagRow = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

function extractImageUrls(row: { image_urls?: string[] | null; image_url?: string | null }) {
  return row.image_urls && row.image_urls.length > 0
    ? row.image_urls
    : row.image_url
      ? [row.image_url]
      : [];
}

function mapPlaceRow(row: PlaceRow, currentUserId: string): Place {
  const imageUrls = extractImageUrls(row);
  const statuses = row.place_user_status ?? [];
  const mine = statuses.find((entry) => entry.user_id === currentUserId);

  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    status: mine?.status ?? "want_to_go",
    rating: mine?.rating ?? null,
    priceRange: row.price_range as Place["priceRange"],
    visitDate: row.visit_date,
    latitude: row.latitude,
    longitude: row.longitude,
    imageUrls,
    imageUrl: imageUrls[0] ?? null,
    tagIds: row.place_tags?.map((tag) => tag.tag_id) ?? [],
    isPublic: row.is_public ?? false,
    collectionId: row.collection_id,
    memberStatuses: row.collection_id
      ? statuses.map((entry) => ({
          userId: entry.user_id,
          status: entry.status,
          rating: entry.rating,
        }))
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PLACE_IMAGE_BUCKET = "place-images";

async function uploadPlaceImage(placeId: string, file: File) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const extension = file.name.split(".").pop() || "jpg";
  const filePath = `places/${user.id}/${placeId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(PLACE_IMAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(PLACE_IMAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function uploadPlaceImages(placeId: string, files: File[]) {
  const urls = await Promise.all(files.map((file) => uploadPlaceImage(placeId, file)));
  return urls.filter((url): url is string => Boolean(url));
}

function storagePathFromUrl(url: string) {
  const path = url.split(`/${PLACE_IMAGE_BUCKET}/`)[1]?.split("?")[0];
  return path?.startsWith("places/") ? decodeURIComponent(path) : null;
}

// Best-effort: the DB row is already updated, so a failed cleanup only leaves
// an orphaned file behind. Storage RLS limits this to places the caller can access.
async function removePlaceImageFiles(urls: string[]) {
  const supabase = getSupabaseBrowserClient();
  const paths = urls
    .map(storagePathFromUrl)
    .filter((path): path is string => Boolean(path));
  if (!supabase || paths.length === 0) return;

  const { error } = await supabase.storage.from(PLACE_IMAGE_BUCKET).remove(paths);
  if (error) console.error("Error removing place images:", error);
}

async function getPlaceImageUrls(placeId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("places")
    .select("image_urls, image_url")
    .eq("id", placeId)
    .single();
  return data ? extractImageUrls(data) : [];
}

async function fetchPlace(placeId: string, currentUserId: string): Promise<Place | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("places")
    .select(PLACE_SELECT)
    .eq("id", placeId)
    .single();

  if (error) throw error;
  return data ? mapPlaceRow(data as PlaceRow, currentUserId) : null;
}

async function updatePlaceImageColumns(placeId: string, imageUrls: string[]): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const primaryImageUrl = imageUrls[0] ?? null;

  const { error } = await supabase
    .from("places")
    .update({ image_urls: imageUrls, image_url: primaryImageUrl })
    .eq("id", placeId);

  if (!error) return;

  const isMissingImageUrlsColumn =
    error.message?.toLowerCase().includes("image_urls") ||
    error.details?.toLowerCase().includes("image_urls") ||
    error.hint?.toLowerCase().includes("image_urls");

  if (!isMissingImageUrlsColumn) {
    throw error;
  }

  const { error: fallbackError } = await supabase
    .from("places")
    .update({ image_url: primaryImageUrl })
    .eq("id", placeId);

  if (fallbackError) throw fallbackError;
}

function mapTagRow(row: TagRow): JournalTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

async function requireCurrentUserId(supabase: ReturnType<typeof getSupabaseBrowserClient>) {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listPlaces(): Promise<Place[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const currentUserId = await requireCurrentUserId(supabase);
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from("places")
    .select(PLACE_SELECT)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as PlaceRow[]).map((row) => mapPlaceRow(row, currentUserId));
}

export async function listTags(): Promise<JournalTag[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as TagRow[]).map(mapTagRow);
}

export async function createTag(input: {
  name: string;
  color: string;
}): Promise<JournalTag | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tags")
    .insert({ name: input.name, color: input.color })
    .select("*")
    .single();

  if (error) throw error;
  return data ? mapTagRow(data as TagRow) : null;
}

/** Upserts the current user's own status/rating for a place they can access. */
export async function upsertMyPlaceStatus(
  placeId: string,
  patch: { status?: Place["status"]; rating?: number | null }
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const currentUserId = await requireCurrentUserId(supabase);
  if (!currentUserId) return;

  let status = patch.status;
  if (status === undefined) {
    const { data: existing } = await supabase
      .from("place_user_status")
      .select("status")
      .eq("place_id", placeId)
      .eq("user_id", currentUserId)
      .maybeSingle();
    status = existing?.status ?? "want_to_go";
  }

  const rating = status === "visited" ? patch.rating ?? null : null;

  const { error } = await supabase
    .from("place_user_status")
    .upsert(
      { place_id: placeId, user_id: currentUserId, status, rating },
      { onConflict: "place_id,user_id" }
    );

  if (error) throw error;
}

export async function createPlace(input: CreatePlaceInput): Promise<Place | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const currentUserId = await requireCurrentUserId(supabase);
  if (!currentUserId) return null;

  const payload = {
    name: input.name,
    notes: input.notes ?? null,
    price_range: input.priceRange ?? null,
    visit_date: input.visitDate ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    is_public: input.isPublic ?? false,
    collection_id: input.collectionId ?? null,
  };

  const { data, error } = await supabase
    .from("places")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  if (!data) return null;
  const placeId = data.id as string;

  const { error: statusError } = await supabase.from("place_user_status").insert({
    place_id: placeId,
    status: input.status,
    rating: input.status === "visited" ? input.rating ?? null : null,
  });
  if (statusError) throw statusError;

  if (input.tagIds?.length) {
    const { error: relationError } = await supabase
      .from("place_tags")
      .insert(input.tagIds.map((tagId) => ({ place_id: placeId, tag_id: tagId })));
    if (relationError) throw relationError;
  }

  if (input.imageFiles && input.imageFiles.length > 0) {
    const imageUrls = await uploadPlaceImages(placeId, input.imageFiles);
    if (imageUrls.length > 0) {
      await updatePlaceImageColumns(placeId, imageUrls);
    }
  }

  return fetchPlace(placeId, currentUserId);
}

export async function updatePlace(
  placeId: string,
  input: UpdatePlaceInput
): Promise<Place | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const currentUserId = await requireCurrentUserId(supabase);
  if (!currentUserId) return null;

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.notes !== undefined) payload.notes = input.notes || null;
  if (input.priceRange !== undefined) payload.price_range = input.priceRange;
  if (input.visitDate !== undefined) payload.visit_date = input.visitDate || null;
  if (input.latitude !== undefined) payload.latitude = input.latitude;
  if (input.longitude !== undefined) payload.longitude = input.longitude;
  if (input.isPublic !== undefined) payload.is_public = input.isPublic;
  if (input.collectionId !== undefined) payload.collection_id = input.collectionId;

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from("places")
      .update(payload)
      .eq("id", placeId);

    if (error) throw error;
  }

  if (input.status !== undefined || input.rating !== undefined) {
    await upsertMyPlaceStatus(placeId, { status: input.status, rating: input.rating });
  }

  if (input.imageFiles?.length || input.keepImageUrls !== undefined) {
    const existing = await getPlaceImageUrls(placeId);
    // Only ever keep URLs the place already has; everything else is removed.
    const kept = input.keepImageUrls
      ? existing.filter((url) => input.keepImageUrls?.includes(url))
      : existing;
    const added = input.imageFiles?.length
      ? await uploadPlaceImages(placeId, input.imageFiles)
      : [];

    await updatePlaceImageColumns(placeId, [...kept, ...added]);
    await removePlaceImageFiles(existing.filter((url) => !kept.includes(url)));
  }

  if (input.tagIds) {
    const { error: deleteError } = await supabase
      .from("place_tags")
      .delete()
      .eq("place_id", placeId);

    if (deleteError) throw deleteError;

    if (input.tagIds.length > 0) {
      const relationRows = input.tagIds.map((tagId) => ({
        place_id: placeId,
        tag_id: tagId,
      }));

      const { error: insertError } = await supabase
        .from("place_tags")
        .insert(relationRows);

      if (insertError) throw insertError;
    }
  }

  return fetchPlace(placeId, currentUserId);
}

export async function deletePlace(placeId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const imageUrls = await getPlaceImageUrls(placeId);

  const { error } = await supabase.from("places").delete().eq("id", placeId);
  if (error) throw error;

  await removePlaceImageFiles(imageUrls);
}

export async function setPlacesPublicByStatus(
  status: Place["status"],
  isPublic: boolean
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const currentUserId = await requireCurrentUserId(supabase);
  if (!currentUserId) return;

  // Personal places only -- shared collection places never appear on the
  // public showcase, so there is nothing to toggle for them here.
  const { data: statusRows, error: statusError } = await supabase
    .from("place_user_status")
    .select("place_id")
    .eq("user_id", currentUserId)
    .eq("status", status);

  if (statusError) throw statusError;
  const placeIds = (statusRows ?? []).map((row) => row.place_id as string);
  if (placeIds.length === 0) return;

  const { error } = await supabase
    .from("places")
    .update({ is_public: isPublic })
    .in("id", placeIds)
    .is("collection_id", null);

  if (error) throw error;
}
