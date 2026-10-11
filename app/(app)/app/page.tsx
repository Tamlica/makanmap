"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, Plus, Search, X } from "lucide-react";

import { AccountMenu } from "@/components/account/account-menu";
import { CollectionSwitcher } from "@/components/collections/collection-switcher";
import { PendingInvitesBanner } from "@/components/collections/pending-invites-banner";
import { PlaceMap } from "@/components/map/place-map";
import { FilterPanel } from "@/components/place/filter-panel";
import { PlaceDetailPanel } from "@/components/place/place-detail-panel";
import { PlaceForm } from "@/components/place/place-form";
import { filterPlaces } from "@/lib/food-journal-utils";
import { useCollectionsStore } from "@/lib/stores/use-collections-store";
import { useFoodJournalStore } from "@/lib/stores/use-food-journal-store";
import { useMapUiStore } from "@/lib/stores/use-map-ui-store";
import { loadGoogleMapsPlaces } from "@/lib/hooks/use-google-places";
import { getRoutes, formatDistance, formatDuration } from "@/lib/routing";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MapRef } from "@/components/ui/map";
import type { Place } from "@/lib/types/food-journal";

type SearchResult = {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
};

export default function Home() {
  const router = useRouter();
  const mapRef = useRef<MapRef | null>(null);

  const {
    places,
    tags,
    filters,
    connectionStatus,
    errorMessage,
    hydrate,
    addPlace,
    editPlace,
    removePlace,
    addTag,
    setFilters,
    toggleStatus,
    toggleTagFilter,
    resetFilters,
  } = useFoodJournalStore();

  const {
    selectedPlaceId,
    isAddOpen,
    isDetailOpen,
    isFilterOpen,
    draftCoordinates,
    routes,
    selectedRouteIndex,
    isRouteLoading,
    routeError,
    openAdd,
    closeAdd,
    openDetail,
    closeDetail,
    toggleFilter,
    closeFilter,
    setRoutes,
    selectRoute,
    clearRoutes,
    setRouteLoading,
    setRouteError,
    updateDraftCoordinates,
  } = useMapUiStore();

  const collections = useCollectionsStore((state) => state.collections);
  const activeCollectionId = useCollectionsStore((state) => state.activeCollectionId);
  const membersByCollection = useCollectionsStore((state) => state.membersByCollection);
  const hydrateCollections = useCollectionsStore((state) => state.hydrate);
  const loadCollectionMembers = useCollectionsStore((state) => state.loadMembers);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMapsLoaded, setIsMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void hydrate();
    void hydrateCollections();
  }, [hydrate, hydrateCollections]);

  useEffect(() => {
    loadGoogleMapsPlaces()
      .then(() => {
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        setIsMapsLoaded(true);
      })
      .catch((err: unknown) => {
        setMapsError(err instanceof Error ? err.message : "Failed to load Google Maps");
      });
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const placeFormKey = useMemo(
    () => `${editingPlace?.id ?? 'new'}-${draftCoordinates?.latitude}-${draftCoordinates?.longitude}`,
    [editingPlace, draftCoordinates]
  );

  const scopedPlaces = useMemo(
    () => places.filter((place) => place.collectionId === activeCollectionId),
    [places, activeCollectionId]
  );

  const filteredPlaces = useMemo(
    () => filterPlaces(scopedPlaces, filters),
    [scopedPlaces, filters]
  );

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId]
  );

  useEffect(() => {
    if (!selectedPlace && isDetailOpen) {
      closeDetail();
    }
  }, [selectedPlace, isDetailOpen, closeDetail]);

  useEffect(() => {
    if (selectedPlace?.collectionId) {
      void loadCollectionMembers(selectedPlace.collectionId);
    }
  }, [selectedPlace?.collectionId, loadCollectionMembers]);

  const selectedPlaceMembers = selectedPlace?.collectionId
    ? membersByCollection[selectedPlace.collectionId] ?? []
    : [];

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setSearchResults([]);

    if (!value.trim() || !autocompleteServiceRef.current) return;

    debounceRef.current = setTimeout(() => {
      setIsSearching(true);
      autocompleteServiceRef.current!.getPlacePredictions(
        { input: value.trim() },
        (predictions, status) => {
          setIsSearching(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSearchResults(
              predictions.map((p) => ({
                place_id: p.place_id,
                description: p.description,
                main_text: p.structured_formatting.main_text,
                secondary_text: p.structured_formatting.secondary_text,
              }))
            );
          }
        }
      );
    }, 300);
  }, []);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (searchResults.length > 0) {
      handleSearchSelect(searchResults[0]);
    }
  };

  const handleSearchSelect = (result: SearchResult) => {
    setIsSearching(true);

    const service = new google.maps.places.PlacesService(document.createElement("div"));
    service.getDetails(
      { placeId: result.place_id, fields: ["geometry"] },
      (place, status) => {
        setIsSearching(false);
        setSearchResults([]);
        setSearchValue("");

        if (
          status === google.maps.places.PlacesServiceStatus.OK &&
          place?.geometry?.location
        ) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          mapRef.current?.easeTo({ center: [lng, lat], zoom: 14, duration: 700 });
          openAdd({ latitude: lat, longitude: lng });
        }
      }
    );
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleMapPick = (coords: { longitude: number; latitude: number }) => {
    if (isAddOpen || isDetailOpen) {
      closeAdd();
      closeDetail();
      return;
    }
    openAdd({ latitude: coords.latitude, longitude: coords.longitude });
    setEditingPlace(null);
  };

  const handleCoordinatesChange = (coords: { longitude: number; latitude: number } | null) => {
    updateDraftCoordinates(coords);
  };

  const handleGetDirections = async (placeCoords: { longitude: number; latitude: number }) => {
    if (!("geolocation" in navigator)) {
      setRouteError("Geolocation is not supported by your browser");
      return;
    }

    setRouteLoading(true);
    setRouteError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const from: [number, number] = [position.coords.longitude, position.coords.latitude];
      const to: [number, number] = [placeCoords.longitude, placeCoords.latitude];

      const allRoutes = await getRoutes(from, to);
      setRoutes(allRoutes);
      closeDetail();
    } catch (err) {
      setRouteLoading(false);
      if (err instanceof DOMException && err.name === "TimeoutError") {
        setRouteError("Location request timed out. Please try again.");
      } else if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setRouteError("Location access denied. Please enable location permissions.");
            break;
          case err.POSITION_UNAVAILABLE:
            setRouteError("Unable to determine your location.");
            break;
          default:
            setRouteError("Failed to find route. Please try again.");
        }
      } else if (err instanceof Error && err.message.includes("No route")) {
        setRouteError("No route found to this location");
      } else {
        setRouteError("Failed to find route. Please try again.");
      }
    }
  };

  const handleOpenAdd = () => {
    closeDetail();
    setEditingPlace(null);
    openAdd(null);
  };

  const handleDeleteImage = (place: Place, imageUrl: string) => {
    void editPlace(place.id, {
      keepImageUrls: place.imageUrls.filter((url) => url !== imageUrl),
    });
  };

  const handleSubmitPlace = async (payload: {
    name: string;
    notes?: string;
    status: Place["status"];
    rating?: number;
    priceRange?: number;
    visitDate?: string;
    latitude: number;
    longitude: number;
    tagIds?: string[];
    collectionId?: string | null;
    imageFiles?: File[];
    keepImageUrls?: string[];
  }) => {
    const typedPayload = {
      ...payload,
      priceRange: payload.priceRange,
    };

    if (editingPlace) {
      await editPlace(editingPlace.id, typedPayload);
      setEditingPlace(null);
      closeAdd();
      return;
    }

    await addPlace(typedPayload);
    closeAdd();
  };

  const showDesktopPanel = "hidden md:block";
  const showMobilePanel = "md:hidden";

  return (
    <main className="relative w-screen overflow-hidden bg-background text-foreground" style={{ height: '100dvh' }}>
      <div className="absolute inset-0">
        <PlaceMap
          places={filteredPlaces}
          selectedPlaceId={selectedPlaceId}
          mapRef={mapRef}
          onPlaceSelect={(placeId) => openDetail(placeId)}
          onMapPick={handleMapPick}
          routes={routes}
          selectedRouteIndex={selectedRouteIndex}
          onSelectRoute={selectRoute}
          draftCoordinates={draftCoordinates}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-30">
        <div className="pointer-events-auto absolute left-1/2 top-3 w-[min(92vw,760px)] -translate-x-1/2 rounded-2xl border border-border bg-card/90 p-2 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <input
                value={searchValue}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search location"
                className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </form>
            {/* <button
              type="button"
              onClick={handleOpenAdd}
              className="hidden items-center gap-1 rounded-md border border-border bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 md:inline-flex"
            >
              <Plus className="size-3.5" />
              Add Place
            </button> */}
          </div>

          {(mapsError || (searchValue.trim() && !isMapsLoaded) || isSearching || searchResults.length > 0) && (
            <div className="mt-2 rounded-md border border-border bg-background">
              {mapsError ? (
                <p className="px-3 py-2 text-xs text-red-500">{mapsError}</p>
              ) : !isMapsLoaded && searchValue.trim() ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Loading Google Maps...</p>
              ) : isSearching ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Searching...</p>
              ) : (
                <ul className="max-h-56 overflow-auto py-1">
                  {searchResults.map((result) => (
                    <li key={result.place_id}>
                      <button
                        type="button"
                        onClick={() => handleSearchSelect(result)}
                        className="w-full px-3 py-2 text-left transition hover:bg-accent"
                      >
                        <span className="block text-sm font-medium text-foreground">
                          {result.main_text}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {result.secondary_text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="pointer-events-auto absolute right-3 top-3 hidden items-center gap-2 md:inline-flex">
          {/* <div className="flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
            <span
              className={`inline-block size-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-500"
                  : connectionStatus === "checking"
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
            />
            {connectionStatus === "connected"
              ? "Supabase connected"
              : connectionStatus === "checking"
                ? "Checking Supabase"
                : "Supabase disconnected"}
          </div> */}
          <CollectionSwitcher />
          <AccountMenu onSignOut={handleSignOut} isSigningOut={isSigningOut} />
        </div>

        <div className="pointer-events-auto absolute right-3 top-18 flex items-center gap-2 md:hidden">
          {/* <div className="flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
            <span
              className={`inline-block size-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-500"
                  : connectionStatus === "checking"
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
            />
            {connectionStatus === "connected"
              ? "Supabase connected"
              : connectionStatus === "checking"
                ? "Checking Supabase"
                : "Supabase disconnected"}
          </div> */}
          <CollectionSwitcher />
          <AccountMenu onSignOut={handleSignOut} isSigningOut={isSigningOut} />
        </div>

        <PendingInvitesBanner />

        <div className="pointer-events-auto absolute left-3 top-18">
          <button
            type="button"
            onClick={toggleFilter}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card/90 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur transition hover:bg-accent"
          >
            <Filter className="size-3.5" />
            Filters
          </button>
        </div>

        {isFilterOpen && (
          <div className="pointer-events-auto absolute left-3 top-28 w-75 max-w-[92vw]">
            <FilterPanel
              tags={tags}
              filters={filters}
              onSearchNameChange={(name) => setFilters({ searchName: name })}
              onToggleStatus={toggleStatus}
              onSetMinRating={(value) => setFilters({ minRating: value })}
              onToggleTag={toggleTagFilter}
              onSetPriceRange={({ min, max }) =>
                setFilters({ priceMin: min, priceMax: max })
              }
              onReset={() => {
                resetFilters();
                closeFilter();
              }}
            />
          </div>
        )}

        <div className={`pointer-events-auto absolute right-3 top-24 h-[calc(100vh-8rem)] w-85 ${showDesktopPanel}`}>
          {selectedPlace && isDetailOpen ? (
            <PlaceDetailPanel
              place={selectedPlace}
              tags={tags}
              collectionMembers={selectedPlaceMembers}
              onClose={closeDetail}
              onDeleteImage={handleDeleteImage}
              onDelete={(placeId) => {
                void removePlace(placeId);
                closeDetail();
              }}
              onEdit={(place) => {
                closeDetail();
                setEditingPlace(place);
                openAdd({ latitude: place.latitude, longitude: place.longitude });
              }}
              onGetDirections={handleGetDirections}
              isRouteLoading={isRouteLoading}
              routeError={routeError}
            />
          ) : null}
        </div>

        {errorMessage ? (
          <div className="pointer-events-auto absolute bottom-4 left-3 rounded-md border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
            {errorMessage}
          </div>
        ) : null}

        {isAddOpen && (
          <div className={`pointer-events-auto fixed inset-x-3 bottom-3 z-40 max-h-[50dvh] overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${showMobilePanel}`}>
            <div className="m-1.5 max-h-[calc(50dvh-1.75rem)] overflow-y-auto p-2.5">
            <PlaceForm
              key={placeFormKey}
              title={editingPlace ? "Edit Place" : "Add Place"}
              tags={tags}
              collections={collections.filter((c) => c.myStatus === "active")}
              defaultCollectionId={activeCollectionId}
              initialPlace={editingPlace}
              initialCoordinates={draftCoordinates}
              onSubmit={handleSubmitPlace}
              onCreateTag={addTag}
              onCancel={() => {
                closeAdd();
                setEditingPlace(null);
              }}
              onCoordinatesChange={handleCoordinatesChange}
            />
            </div>
          </div>
        )}

        {isAddOpen && (
          <div className={`pointer-events-auto absolute right-3 top-24 z-40 h-[calc(100dvh-8rem)] w-95 ${showDesktopPanel}`}>
            <section className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card/95 p-4 shadow-sm backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {editingPlace ? "Edit Place" : "Add Place"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    closeAdd();
                    setEditingPlace(null);
                  }}
                  className="rounded-md border border-border p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="-mr-2.5 min-h-0 flex-1 overflow-y-auto pr-2.5">
                <PlaceForm
                  key={placeFormKey}
                  title={editingPlace ? "Edit Place" : "Add Place"}
                  tags={tags}
                  collections={collections.filter((c) => c.myStatus === "active")}
                  defaultCollectionId={activeCollectionId}
                  initialPlace={editingPlace}
                  initialCoordinates={draftCoordinates}
                  onSubmit={handleSubmitPlace}
                  onCreateTag={addTag}
                  onCancel={() => {
                    closeAdd();
                    setEditingPlace(null);
                  }}
                  onCoordinatesChange={handleCoordinatesChange}
                />
              </div>
            </section>
          </div>
        )}

        {selectedPlace && isDetailOpen && (
          <div className={`pointer-events-auto fixed inset-x-3 bottom-3 z-40 flex max-h-[55dvh] flex-col rounded-2xl border border-border bg-card p-4 shadow-sm ${showMobilePanel}`}>
            <PlaceDetailPanel
              place={selectedPlace}
              tags={tags}
              collectionMembers={selectedPlaceMembers}
              onClose={closeDetail}
              onDeleteImage={handleDeleteImage}
              onDelete={(placeId) => {
                void removePlace(placeId);
                closeDetail();
              }}
              onEdit={(place) => {
                closeDetail();
                setEditingPlace(place);
                openAdd({ latitude: place.latitude, longitude: place.longitude });
              }}
              onGetDirections={handleGetDirections}
              isRouteLoading={isRouteLoading}
              routeError={routeError}
            />
          </div>
        )}

        {routes.length > 0 && (
          <div className="pointer-events-auto fixed inset-x-3 bottom-3 z-40 flex items-center gap-2 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur md:inset-x-auto md:right-3 md:bottom-5 md:w-80">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block size-2 rounded-full bg-blue-500" />
                <span className="font-medium text-foreground">{formatDistance(routes[selectedRouteIndex].distanceMeters)}</span>
                <span className="text-border">·</span>
                <span>{formatDuration(routes[selectedRouteIndex].durationSeconds)}</span>
              </div>
            </div>
            {routes.length > 1 && (
              <div className="flex items-center gap-1">
                {routes.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectRoute(index)}
                    className={`size-6 rounded-full text-[10px] font-medium transition ${
                      index === selectedRouteIndex
                        ? "bg-blue-500 text-white"
                        : "border border-border bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={clearRoutes}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {!isAddOpen && routes.length === 0 && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className={`pointer-events-auto fixed bottom-5 right-5 z-40 inline-flex size-12 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-sm transition hover:opacity-90 ${showMobilePanel}`}
            aria-label="Add place"
          >
            <Plus className="size-5" />
          </button>
        )}
      </div>
    </main>
  );
}
