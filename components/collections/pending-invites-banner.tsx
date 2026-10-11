"use client";

import { useCollectionsStore } from "@/lib/stores/use-collections-store";

export function PendingInvitesBanner() {
  const collections = useCollectionsStore((state) => state.collections);
  const acceptInvite = useCollectionsStore((state) => state.acceptInvite);
  const declineInvite = useCollectionsStore((state) => state.declineInvite);

  const pending = collections.filter((c) => c.myStatus === "pending");
  if (pending.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-16 z-30 w-[min(92vw,420px)] -translate-x-1/2 space-y-2">
      {pending.map((collection) => (
        <div
          key={collection.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-3 py-2 text-sm shadow-sm backdrop-blur"
        >
          <span className="min-w-0 truncate text-foreground">
            Invited to <span className="font-medium">{collection.name}</span>
          </span>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => void acceptInvite(collection.id)}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:brightness-110 cursor-pointer"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => void declineInvite(collection.id)}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground transition hover:bg-accent cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
