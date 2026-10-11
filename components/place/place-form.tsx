"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Star, StarHalf, X } from "lucide-react";

import {
  MAX_PRICE_IDR,
  MIN_PRICE_IDR,
  PLACE_STATUS_OPTIONS,
  PRICE_STEP_IDR,
  STATUS_STYLE,
} from "@/lib/constants/food-journal";
import { Slider } from "@/components/ui/slider";
import { formatIdr } from "@/lib/format";
import type {
  CreatePlaceInput,
  JournalTag,
  Place,
  PlaceStatus,
  PriceRange,
} from "@/lib/types/food-journal";
import type { MyCollection } from "@/lib/supabase/collection-queries";

type PlaceFormProps = {
  title: string;
  tags: JournalTag[];
  collections: MyCollection[];
  initialPlace?: Place | null;
  initialCoordinates?: { latitude: number; longitude: number } | null;
  defaultCollectionId?: string | null;
  onSubmit: (value: CreatePlaceInput) => Promise<void>;
  onCreateTag: (value: { name: string; color: string }) => Promise<void>;
  onCancel: () => void;
  onCoordinatesChange?: (coordinates: { longitude: number; latitude: number } | null) => void;
};

const tagColors = [
  "#1f2937",
  "#334155",
  "#475569",
  "#64748b",
  "#7c3aed",
  "#2563eb",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#f97316",
  "#a855f7",
] as const;

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

export function PlaceForm({
  title,
  tags,
  collections,
  initialPlace,
  initialCoordinates,
  defaultCollectionId,
  onSubmit,
  onCreateTag,
  onCancel,
  onCoordinatesChange,
}: PlaceFormProps) {
  const initialLatitude = initialPlace?.latitude ?? initialCoordinates?.latitude ?? null;
  const initialLongitude = initialPlace?.longitude ?? initialCoordinates?.longitude ?? null;

  const [name, setName] = useState(initialPlace?.name ?? "");
  const [notes, setNotes] = useState(initialPlace?.notes ?? "");
  const [status, setStatus] = useState<PlaceStatus>(
    initialPlace?.status ?? "want_to_go"
  );
  const [rating, setRating] = useState(initialPlace?.rating ?? 4);
  const [priceRange, setPriceRange] = useState<PriceRange>(
    initialPlace?.priceRange ?? MIN_PRICE_IDR
  );
  const [visitDate, setVisitDate] = useState(initialPlace?.visitDate ?? "");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (initialPlace?.visitDate) {
      return new Date(`${initialPlace.visitDate}T00:00:00`);
    }
    return new Date();
  });
  const [tagIds, setTagIds] = useState<string[]>(initialPlace?.tagIds ?? []);
  const [isPublic, setIsPublic] = useState(initialPlace?.isPublic ?? false);
  const [collectionId, setCollectionId] = useState<string | null>(
    initialPlace ? initialPlace.collectionId : defaultCollectionId ?? null
  );
  const [latitudeText, setLatitudeText] = useState(initialLatitude != null ? String(initialLatitude) : "");
  const [longitudeText, setLongitudeText] = useState(initialLongitude != null ? String(initialLongitude) : "");
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState<(typeof tagColors)[number]>(tagColors[0]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const resolvedCoordinates = useMemo(() => {
    const parsedLatitude = Number(latitudeText);
    const parsedLongitude = Number(longitudeText);

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      return null;
    }

    return {
      latitude: parsedLatitude,
      longitude: parsedLongitude,
    };
  }, [latitudeText, longitudeText]);

  const [keptImageUrls, setKeptImageUrls] = useState<string[]>(() => {
    if (initialPlace?.imageUrls?.length) {
      return initialPlace.imageUrls;
    }
    return initialPlace?.imageUrl ? [initialPlace.imageUrl] : [];
  });

  const imagePreviewUrls = useMemo(
    () => imageFiles.map((file) => URL.createObjectURL(file)),
    [imageFiles]
  );

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

  const toggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (imageError) return;

    if (!resolvedCoordinates) {
      setCoordinateError("Latitude and longitude must be valid numbers.");
      return;
    }
    if (resolvedCoordinates.latitude < -90 || resolvedCoordinates.latitude > 90) {
      setCoordinateError("Latitude must be between -90 and 90.");
      return;
    }
    if (resolvedCoordinates.longitude < -180 || resolvedCoordinates.longitude > 180) {
      setCoordinateError("Longitude must be between -180 and 180.");
      return;
    }

    setCoordinateError(null);

    setIsSubmitting(true);
    await onSubmit({
      name: name.trim(),
      notes: notes.trim() || undefined,
      status,
      rating: status === "visited" ? Math.max(1, Math.min(5, rating)) : undefined,
      priceRange,
      visitDate: status === "visited" ? visitDate || undefined : undefined,
      latitude: resolvedCoordinates.latitude,
      longitude: resolvedCoordinates.longitude,
      tagIds,
      isPublic,
      collectionId,
      imageFiles: imageFiles.length > 0 ? imageFiles : undefined,
      keepImageUrls: initialPlace ? keptImageUrls : undefined,
    });
    setIsSubmitting(false);
  };

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);
    // Let the same file be picked again after removing it.
    event.target.value = "";
    if (nextFiles.length === 0) return;

    const oversizedFiles = nextFiles.filter((file) => file.size > MAX_IMAGE_SIZE_BYTES);
    const validFiles = nextFiles.filter((file) => file.size <= MAX_IMAGE_SIZE_BYTES);

    if (oversizedFiles.length > 0) {
      setImageError(
        `Each image must be 20MB or smaller. Too large: ${oversizedFiles
          .map((file) => file.name)
          .join(", ")}`
      );
    } else {
      setImageError(null);
    }

    setImageFiles((prev) => [...prev, ...validFiles]);
  };

  const submitTag = async () => {
    if (!tagName.trim()) return;
    await onCreateTag({ name: tagName.trim(), color: tagColor });
    setTagName("");
  };

  const formattedVisitDate = visitDate
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
      }).format(new Date(`${visitDate}T00:00:00`))
    : "Pick a date";

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const startDay = start.getDay();
    const daysInMonth = end.getDate();

    const days: Array<{ date: Date; inMonth: boolean }> = [];

    for (let i = 0; i < startDay; i += 1) {
      days.push({ date: new Date(year, month, i - startDay + 1), inMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push({ date: new Date(year, month, day), inMonth: true });
    }

    return days;
  }, [calendarMonth]);

  const isSelectedDate = (date: Date) => {
    if (!visitDate) return false;
    const selected = new Date(`${visitDate}T00:00:00`);
    return (
      selected.getFullYear() === date.getFullYear() &&
      selected.getMonth() === date.getMonth() &&
      selected.getDate() === date.getDate()
    );
  };

  const isToday = (date: Date) => {
    const now = new Date();
    return (
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate()
    );
  };

  const formatDateValue = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {resolvedCoordinates
            ? `${resolvedCoordinates.latitude.toFixed(5)}, ${resolvedCoordinates.longitude.toFixed(5)}`
            : "Invalid coordinates"}
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Coordinates</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            value={latitudeText}
            onChange={(event) => {
              setLatitudeText(event.target.value);
              if (coordinateError) setCoordinateError(null);
              const lat = Number(event.target.value);
              const lng = Number(longitudeText);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                onCoordinatesChange?.({ longitude: lng, latitude: lat });
              }
            }}
            placeholder="Latitude"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            type="number"
            step="any"
            value={longitudeText}
            onChange={(event) => {
              setLongitudeText(event.target.value);
              if (coordinateError) setCoordinateError(null);
              const lat = Number(latitudeText);
              const lng = Number(event.target.value);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                onCoordinatesChange?.({ longitude: lng, latitude: lat });
              }
            }}
            placeholder="Longitude"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {coordinateError ? (
          <p className="text-[11px] text-destructive">{coordinateError}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Status</label>
        <div className="grid grid-cols-3 gap-2">
          {PLACE_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setStatus(option.value);
                if (option.value !== "visited") {
                  setVisitDate("");
                }
              }}
              className={`rounded-md border px-2 py-2 text-xs transition ${
                status === option.value
                  ? "text-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
              style={{
                borderColor:
                  status === option.value
                    ? STATUS_STYLE[option.value].pointColor
                    : undefined,
                backgroundColor:
                  status === option.value
                    ? `${STATUS_STYLE[option.value].pointColor}1a`
                    : undefined,
                boxShadow:
                  status === option.value
                    ? `0 0 0 1px ${STATUS_STYLE[option.value].pointColor}`
                    : undefined,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {status === "visited" && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Rating ({rating.toFixed(1)})
          </label>
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, index) => {
                const fullValue = index + 1;
                const halfValue = index + 0.5;
                const isFull = rating >= fullValue;
                const isHalf = !isFull && rating >= halfValue;

                return (
                  <div key={`star-${index}`} className="relative">
                    <button
                      type="button"
                      onClick={() => setRating(halfValue)}
                      className="absolute left-0 top-0 h-full w-1/2"
                      aria-label={`Set rating ${halfValue}`}
                    />
                    <button
                      type="button"
                      onClick={() => setRating(fullValue)}
                      className="absolute right-0 top-0 h-full w-1/2"
                      aria-label={`Set rating ${fullValue}`}
                    />
                    {isFull ? (
                      <Star className="size-6 fill-current text-foreground" />
                    ) : isHalf ? (
                      <StarHalf className="size-6 fill-current text-foreground" />
                    ) : (
                      <Star className="size-6 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setRating(0.5)}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Price (IDR)</span>
          <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground">
            {formatIdr(priceRange)}
          </span>
        </div>
        <Slider
          min={MIN_PRICE_IDR}
          max={MAX_PRICE_IDR}
          step={PRICE_STEP_IDR}
          value={[priceRange]}
          onValueChange={([next]) => setPriceRange(next)}
          thumbLabels={["Price"]}
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{formatIdr(MIN_PRICE_IDR)}</span>
          <span>{formatIdr(MAX_PRICE_IDR)}</span>
        </div>
      </div>

      {status === "visited" && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Visit Date</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDatePickerOpen((prev) => !prev)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground transition focus-visible:ring-2 focus-visible:ring-ring"
            >
              {formattedVisitDate}
            </button>
            {isDatePickerOpen ? (
              <div className="absolute z-30 mt-2 w-full rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() - 1,
                          1
                        )
                      )
                    }
                    className="rounded-md border border-border p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-xs font-semibold text-foreground">
                    {new Intl.DateTimeFormat("id-ID", {
                      month: "long",
                      year: "numeric",
                    }).format(calendarMonth)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() + 1,
                          1
                        )
                      )
                    }
                    className="rounded-md border border-border p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground">
                  {"SMTWTFS".split("").map((label) => (
                    <span key={label} className="text-center">
                      {label}
                    </span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {calendarDays.map(({ date, inMonth }) => {
                    const selected = isSelectedDate(date);
                    const today = isToday(date);
                    return (
                      <button
                        key={`${date.toDateString()}-${inMonth}`}
                        type="button"
                        onClick={() => {
                          setVisitDate(formatDateValue(date));
                          setIsDatePickerOpen(false);
                        }}
                        className={`rounded-md px-1 py-1 text-xs transition ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-accent"
                        } ${inMonth ? "" : "text-muted-foreground/40"}`}
                      >
                        <span
                          className={today && !selected ? "underline underline-offset-2" : ""}
                        >
                          {date.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setVisitDate("");
                      setIsDatePickerOpen(false);
                    }}
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(false)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Place Images</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelection}
          className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:text-foreground"
        />
        <p className="text-[11px] text-muted-foreground">Max 20MB per image.</p>
        {imageError ? (
          <p className="text-[11px] text-destructive">{imageError}</p>
        ) : null}
        {keptImageUrls.length + imagePreviewUrls.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {keptImageUrls.map((imageUrl, index) => (
              <div key={`kept-${imageUrl}`} className="relative">
                <img
                  src={imageUrl}
                  alt={`Place image ${index + 1}`}
                  className="h-28 w-full rounded-md border border-border object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() =>
                    setKeptImageUrls((prev) => prev.filter((url) => url !== imageUrl))
                  }
                  className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {imagePreviewUrls.map((previewUrl, index) => (
              <div key={`new-${previewUrl}`} className="relative">
                <img
                  src={previewUrl}
                  alt={`New image ${index + 1}`}
                  className="h-28 w-full rounded-md border border-dashed border-primary/60 object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove new image ${index + 1}`}
                  onClick={() =>
                    setImageFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))
                  }
                  className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {collections.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Collection</label>
          <select
            value={collectionId ?? ""}
            onChange={(event) => setCollectionId(event.target.value || null)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Personal</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
          className="mt-0.5 size-4 cursor-pointer"
        />
        <span>
          Show on my public page
          <span className="block text-[11px] text-muted-foreground">
            Notes stay private. Only visible if your public page is turned on.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Tags</label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const selected = tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  selected
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground"
                }`}
                style={{ backgroundColor: selected ? `${tag.color}33` : undefined }}
              >
                {tag.name}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <input
            value={tagName}
            onChange={(event) => setTagName(event.target.value)}
            placeholder="New tag"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsColorPickerOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground transition hover:bg-accent"
            >
              <span
                className="size-4 rounded-full border border-border"
                style={{ backgroundColor: tagColor }}
              />
              Color
            </button>
            <button
              type="button"
              onClick={submitTag}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground transition hover:bg-accent"
            >
              <Plus className="size-3.5" />
              Tag
            </button>
          </div>
        </div>

        {isColorPickerOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Choose a color</p>
                <button
                  type="button"
                  onClick={() => setIsColorPickerOpen(false)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {tagColors.map((color) => {
                  const isActive = tagColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setTagColor(color);
                        setIsColorPickerOpen(false);
                      }}
                      aria-label={`Tag color ${color}`}
                      className={`size-8 rounded-full border transition ${
                        isActive
                          ? "border-foreground ring-2 ring-foreground/40"
                          : "border-border hover:border-foreground/60"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground transition hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md border border-border bg-primary px-3 py-2 text-xs text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : initialPlace ? "Save" : "Add Place"}
        </button>
      </div>
    </form>
  );
}
