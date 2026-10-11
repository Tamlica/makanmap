export type PlaceStatus = "visited" | "want_to_go" | "avoid";

export type PriceRange = number;

export type MembershipStatus = "pending" | "active";

export type JournalTag = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type Collection = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type CollectionMember = {
  userId: string;
  username: string;
  displayName: string | null;
  status: MembershipStatus;
};

export type PlaceMemberStatus = {
  userId: string;
  status: PlaceStatus;
  rating: number | null;
};

export type Place = {
  id: string;
  name: string;
  notes: string | null;
  /** The current user's own status/rating (place_user_status). */
  status: PlaceStatus;
  rating: number | null;
  priceRange: PriceRange | null;
  visitDate: string | null;
  latitude: number;
  longitude: number;
  imageUrls: string[];
  imageUrl?: string | null;
  tagIds: string[];
  isPublic: boolean;
  collectionId: string | null;
  /** Every member's status/rating; empty unless collectionId is set. */
  memberStatuses: PlaceMemberStatus[];
  createdAt: string;
  updatedAt: string;
};

export type PlaceFilters = {
  statuses: PlaceStatus[];
  minRating: number;
  priceMin: number;
  priceMax: number;
  tagIds: string[];
  searchName: string;
};

export type CreatePlaceInput = {
  name: string;
  notes?: string;
  status: PlaceStatus;
  rating?: number;
  priceRange?: PriceRange;
  visitDate?: string;
  latitude: number;
  longitude: number;
  tagIds?: string[];
  isPublic?: boolean;
  collectionId?: string | null;
  imageFiles?: File[];
  /** Edit only: existing image URLs to keep. Omit to leave the current images untouched. */
  keepImageUrls?: string[];
};

export type UpdatePlaceInput = Partial<CreatePlaceInput>;
