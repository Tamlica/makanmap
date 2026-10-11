"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, UserMinus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCollectionsStore } from "@/lib/stores/use-collections-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CollectionMember } from "@/lib/types/food-journal";

// Stable reference so the Zustand selector below doesn't return a new array
// on every call when there are no members yet -- a fresh [] fallback each
// time makes useSyncExternalStore think the snapshot changed every render.
const EMPTY_MEMBERS: CollectionMember[] = [];

const inputClassName =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const buttonClassName =
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60";

type CollectionSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CollectionSettingsDialog({ open, onOpenChange }: CollectionSettingsDialogProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const collections = useCollectionsStore((state) => state.collections);
  const createCollection = useCollectionsStore((state) => state.createCollection);

  useEffect(() => {
    if (!open) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const name = newCollectionName.trim();
    if (!name) return;
    setIsCreating(true);
    await createCollection(name);
    setIsCreating(false);
    setNewCollectionName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collections</DialogTitle>
          <DialogDescription>
            Share a collection to add places and ratings together. Everyone sees
            the same places but rates and statuses them on their own.
          </DialogDescription>
        </DialogHeader>

        <form className="flex items-center gap-2" onSubmit={handleCreate}>
          <input
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
            placeholder="New collection name"
            disabled={isCreating}
            className={inputClassName}
          />
          <button type="submit" disabled={isCreating || !newCollectionName.trim()} className={buttonClassName}>
            {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </button>
        </form>

        <hr className="border-border" />

        <div className="flex flex-col gap-3">
          {collections.filter((c) => c.myStatus === "active").length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No collections yet. Create one above to start sharing places.
            </p>
          ) : (
            collections
              .filter((c) => c.myStatus === "active")
              .map((collection) => (
                <CollectionRow
                  key={collection.id}
                  collectionId={collection.id}
                  name={collection.name}
                  isOwner={collection.ownerId === userId}
                  currentUserId={userId}
                />
              ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CollectionRow({
  collectionId,
  name,
  isOwner,
  currentUserId,
}: {
  collectionId: string;
  name: string;
  isOwner: boolean;
  currentUserId: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [usernameValue, setUsernameValue] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const members = useCollectionsStore(
    (state) => state.membersByCollection[collectionId] ?? EMPTY_MEMBERS
  );
  const loadMembers = useCollectionsStore((state) => state.loadMembers);
  const renameCollection = useCollectionsStore((state) => state.renameCollection);
  const deleteCollection = useCollectionsStore((state) => state.deleteCollection);
  const leaveCollection = useCollectionsStore((state) => state.leaveCollection);
  const inviteMember = useCollectionsStore((state) => state.inviteMember);
  const removeMember = useCollectionsStore((state) => state.removeMember);

  useEffect(() => {
    if (isExpanded) void loadMembers(collectionId);
  }, [isExpanded, collectionId, loadMembers]);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    const username = usernameValue.trim();
    if (!username) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      await inviteMember(collectionId, username);
      setUsernameValue("");
      setFeedback(`Invited ${username}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not invite that user.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground"
      >
        {name}
        <span className="text-xs text-muted-foreground">{isExpanded ? "Hide" : "Manage"}</span>
      </button>

      {isExpanded && (
        <div className="mt-3 flex flex-col gap-3">
          {isOwner && (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (nameValue.trim() && nameValue.trim() !== name) {
                  void renameCollection(collectionId, nameValue.trim());
                }
              }}
            >
              <input
                value={nameValue}
                onChange={(event) => setNameValue(event.target.value)}
                className={inputClassName}
              />
              <button type="submit" className="rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground transition hover:bg-accent cursor-pointer">
                Rename
              </button>
            </form>
          )}

          <ul className="flex flex-col gap-1.5">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
              >
                <span className="min-w-0 truncate text-foreground">
                  {member.displayName ?? member.username}
                  {member.status === "pending" ? (
                    <span className="ml-1.5 text-muted-foreground">(pending)</span>
                  ) : null}
                </span>
                {isOwner && member.userId !== currentUserId && (
                  <button
                    type="button"
                    aria-label={`Remove ${member.username}`}
                    onClick={() => void removeMember(collectionId, member.userId)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                  >
                    <UserMinus className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {isOwner && (
            <form className="flex items-center gap-2" onSubmit={handleInvite}>
              <input
                value={usernameValue}
                onChange={(event) => setUsernameValue(event.target.value)}
                placeholder="Invite by username"
                disabled={isBusy}
                className={inputClassName}
              />
              <button type="submit" disabled={isBusy || !usernameValue.trim()} className={buttonClassName}>
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : "Invite"}
              </button>
            </form>
          )}

          {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}

          <div className="flex justify-end">
            {isOwner ? (
              <button
                type="button"
                onClick={() => setIsDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive transition hover:bg-destructive/20 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                Delete collection
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void leaveCollection(collectionId)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground transition hover:bg-accent cursor-pointer"
              >
                Leave collection
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={`Delete "${name}"?`}
        description="Places in this collection become personal places owned by whoever added them. This can't be undone."
        confirmLabel="Delete collection"
        destructive
        onConfirm={() => void deleteCollection(collectionId)}
      />
    </div>
  );
}
