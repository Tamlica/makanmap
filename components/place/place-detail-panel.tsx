"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Globe,
  MapPin,
  Pencil,
  Route,
  Star,
  StarHalf,
  Trash2,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { STATUS_STYLE } from "@/lib/constants/food-journal";
import { formatIdr } from "@/lib/format";
import { getTagMap } from "@/lib/food-journal-utils";
import type { CollectionMember, JournalTag, Place } from "@/lib/types/food-journal";

type PlaceDetailPanelProps = {
  place: Place | null;
  tags: JournalTag[];
  /** Other members' status/rating for this place; only relevant when place.collectionId is set. */
  collectionMembers?: CollectionMember[];
  /** Omit onEdit/onDelete to render the panel read-only (public page). */
  onEdit?: (place: Place) => void;
  onDelete?: (placeId: string) => void;
  /** Omit to hide the per-photo delete buttons (public page). */
  onDeleteImage?: (place: Place, imageUrl: string) => void;
  onClose: () => void;
  onGetDirections: (placeCoords: { longitude: number; latitude: number }) => void;
  isRouteLoading: boolean;
  routeError: string | null;
};

export function PlaceDetailPanel({
  place,
  tags,
  collectionMembers = [],
  onEdit,
  onDelete,
  onDeleteImage,
  onClose,
  onGetDirections,
  isRouteLoading,
  routeError,
}: PlaceDetailPanelProps) {
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState<number | null>(null);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  if (!place) return null;

  const status = STATUS_STYLE[place.status];
  const tagMap = getTagMap(tags);
  const ratingValue = place.rating ?? 0;
  const imageUrls =
    place.imageUrls && place.imageUrls.length > 0
      ? place.imageUrls
      : place.imageUrl
        ? [place.imageUrl]
        : [];
  const fullscreenImageUrl =
    fullscreenImageIndex !== null ? imageUrls[fullscreenImageIndex] ?? null : null;

  const ratingStars = Array.from({ length: 5 }).map((_, index) => {
    const fullValue = index + 1;
    const halfValue = index + 0.5;
    if (ratingValue >= fullValue) {
      return <Star key={`rating-${index}`} className="size-5 fill-current text-foreground" />;
    }
    if (ratingValue >= halfValue) {
      return <StarHalf key={`rating-${index}`} className="size-5 fill-current text-foreground" />;
    }
    return <Star key={`rating-${index}`} className="size-5 text-muted-foreground" />;
  });

  return (
    <>
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm backdrop-blur">
      {/* Scroll area is inset from the card edge so the scrollbar stays inside it. */}
      <div className="m-1.5 flex min-h-0 flex-1 flex-col overflow-y-auto p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{place.name}</h3>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            <span className={`inline-block size-2 rounded-full ${status.dotClassName}`} />
            {status.label}
          </div>
          {onEdit && place.isPublic ? (
            <div className="ml-1.5 mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
              <Globe className="size-3" />
              Public
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        {imageUrls.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {imageUrls.map((imageUrl, index) => (
              <div key={`${imageUrl}-${index}`} className="relative">
                <button
                  type="button"
                  onClick={() => setFullscreenImageIndex(index)}
                  className="block w-full overflow-hidden rounded-md border border-border"
                >
                  <img
                    src={imageUrl}
                    alt={`${place.name} ${index + 1}`}
                    className="h-32 w-full cursor-zoom-in object-cover"
                  />
                </button>
                {onDeleteImage ? (
                  <button
                    type="button"
                    aria-label={`Delete photo ${index + 1}`}
                    onClick={() => setImageToDelete(imageUrl)}
                    className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 p-1.5 text-white transition hover:bg-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {place.rating ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-muted-foreground">
            <span className="text-xs">Rating</span>
            <div className="flex items-center gap-1 text-foreground">{ratingStars}</div>
            <span className="text-xs text-muted-foreground">{place.rating.toFixed(1)}</span>
          </div>
        ) : null}

        {place.notes ? (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Notes</p>
            <p className="break-words rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
              {place.notes}
            </p>
          </div>
        ) : null}

        {place.collectionId && place.memberStatuses.length > 0 ? (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Members</p>
            <ul className="flex flex-col gap-1.5">
              {place.memberStatuses.map((memberStatus) => {
                const member = collectionMembers.find((m) => m.userId === memberStatus.userId);
                const memberStatusStyle = STATUS_STYLE[memberStatus.status];
                return (
                  <li
                    key={memberStatus.userId}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                  >
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      <span className={`inline-block size-2 rounded-full ${memberStatusStyle.dotClassName}`} />
                      {member?.displayName ?? member?.username ?? "Member"}
                    </span>
                    <span className="text-muted-foreground">
                      {memberStatusStyle.label}
                      {memberStatus.rating ? ` · ${memberStatus.rating.toFixed(1)}★` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {place.tagIds.map((tagId) => {
            const tag = tagMap[tagId];
            if (!tag) return null;

            return (
              <span
                key={tag.id}
                className="rounded-full border border-border px-2.5 py-1 text-xs"
                style={{ backgroundColor: `${tag.color}33` }}
              >
                {tag.name}
              </span>
            );
          })}
        </div>

        <div className="grid gap-2 text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1.5">
            <DollarSign className="size-3.5" />
            Price: {formatIdr(place.priceRange)}
          </p>
          <p className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            Visit Date: {place.visitDate ?? "-"}
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-4">
        <button
          type="button"
          onClick={() => onGetDirections({ longitude: place.longitude, latitude: place.latitude })}
          disabled={isRouteLoading}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground transition hover:bg-accent disabled:opacity-50"
        >
          {isRouteLoading ? (
            <>
              <MapPin className="size-3.5 animate-pulse" />
              Finding route...
            </>
          ) : (
            <>
              <Route className="size-3.5" />
              Get Directions
            </>
          )}
        </button>
        {routeError && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {routeError}
          </p>
        )}

        {onEdit && onDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(place)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground transition hover:bg-accent"
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(place.id)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive transition hover:bg-destructive/20"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </section>

      <ConfirmDialog
        open={imageToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setImageToDelete(null);
        }}
        title="Delete this photo?"
        description="It will be removed from this place and can't be recovered."
        confirmLabel="Delete photo"
        destructive
        onConfirm={() => {
          if (imageToDelete) onDeleteImage?.(place, imageToDelete);
        }}
      >
        {imageToDelete ? (
          <img
            src={imageToDelete}
            alt="Photo to delete"
            className="h-40 w-full rounded-md border border-border object-cover"
          />
        ) : null}
      </ConfirmDialog>

      {fullscreenImageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullscreenImageIndex(null)}
        >
          <button
            type="button"
            onClick={() => setFullscreenImageIndex(null)}
            className="absolute right-4 top-4 rounded-md border border-white/20 bg-black/40 p-2 text-white transition hover:bg-black/60"
          >
            <X className="size-4" />
          </button>

          {imageUrls.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setFullscreenImageIndex((current) => {
                    if (current === null) return 0;
                    return (current - 1 + imageUrls.length) % imageUrls.length;
                  });
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white transition hover:bg-black/60"
              >
                <ChevronLeft className="size-5" />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setFullscreenImageIndex((current) => {
                    if (current === null) return 0;
                    return (current + 1) % imageUrls.length;
                  });
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white transition hover:bg-black/60"
              >
                <ChevronRight className="size-5" />
              </button>

              <div className="absolute bottom-4 rounded-md border border-white/20 bg-black/40 px-2 py-1 text-xs text-white">
                {fullscreenImageIndex !== null ? fullscreenImageIndex + 1 : 1} / {imageUrls.length}
              </div>
            </>
          ) : null}

          <img
            src={fullscreenImageUrl}
            alt={place.name}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
