"use client";

import { useState } from "react";
import { ChevronDown, Settings, Users } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CollectionSettingsDialog } from "@/components/collections/collection-settings-dialog";
import { useCollectionsStore } from "@/lib/stores/use-collections-store";

export function CollectionSwitcher() {
  const collections = useCollectionsStore((state) => state.collections);
  const activeCollectionId = useCollectionsStore((state) => state.activeCollectionId);
  const setActiveCollection = useCollectionsStore((state) => state.setActiveCollection);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const activeCollections = collections.filter((c) => c.myStatus === "active");
  const activeLabel =
    activeCollections.find((c) => c.id === activeCollectionId)?.name ?? "Personal";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Collection"
          className="inline-flex max-w-40 items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-xs text-foreground shadow-sm backdrop-blur transition hover:bg-accent cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Users className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Collections</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setActiveCollection(null)}>
            {activeCollectionId === null ? "✓ " : ""}Personal
          </DropdownMenuItem>
          {activeCollections.map((collection) => (
            <DropdownMenuItem
              key={collection.id}
              onSelect={() => setActiveCollection(collection.id)}
            >
              {activeCollectionId === collection.id ? "✓ " : ""}
              {collection.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setIsSettingsOpen(true)}>
            <Settings />
            Manage collections
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CollectionSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
