import { create } from "zustand";

import {
  acceptInvite,
  createCollection,
  declineInvite,
  deleteCollection,
  inviteMember,
  leaveCollection,
  listCollectionMembers,
  listMyCollections,
  removeMember,
  renameCollection,
  type MyCollection,
} from "@/lib/supabase/collection-queries";
import type { CollectionMember } from "@/lib/types/food-journal";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

type CollectionsState = {
  collections: MyCollection[];
  activeCollectionId: string | null;
  membersByCollection: Record<string, CollectionMember[]>;
  isLoading: boolean;
  errorMessage: string | null;

  hydrate: () => Promise<void>;
  setActiveCollection: (id: string | null) => void;
  createCollection: (name: string) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  inviteMember: (collectionId: string, username: string) => Promise<void>;
  loadMembers: (collectionId: string) => Promise<void>;
  removeMember: (collectionId: string, userId: string) => Promise<void>;
  acceptInvite: (collectionId: string) => Promise<void>;
  declineInvite: (collectionId: string) => Promise<void>;
  leaveCollection: (collectionId: string) => Promise<void>;
};

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  collections: [],
  activeCollectionId: null,
  membersByCollection: {},
  isLoading: false,
  errorMessage: null,

  hydrate: async () => {
    set({ isLoading: true, errorMessage: null });
    try {
      const collections = await listMyCollections();
      set({ collections });
    } catch (error) {
      set({ errorMessage: getErrorMessage(error, "Could not load collections.") });
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveCollection: (id) => set({ activeCollectionId: id }),

  createCollection: async (name) => {
    try {
      const created = await createCollection(name);
      set((state) => ({ collections: [...state.collections, created] }));
    } catch (error) {
      set({ errorMessage: getErrorMessage(error, "Could not create collection.") });
    }
  },

  renameCollection: async (id, name) => {
    const before = get().collections;
    set({
      collections: before.map((c) => (c.id === id ? { ...c, name } : c)),
    });
    try {
      await renameCollection(id, name);
    } catch (error) {
      set({
        collections: before,
        errorMessage: getErrorMessage(error, "Could not rename collection."),
      });
    }
  },

  deleteCollection: async (id) => {
    const before = get().collections;
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
      activeCollectionId: state.activeCollectionId === id ? null : state.activeCollectionId,
    }));
    try {
      await deleteCollection(id);
    } catch (error) {
      set({
        collections: before,
        errorMessage: getErrorMessage(error, "Could not delete collection."),
      });
    }
  },

  inviteMember: async (collectionId, username) => {
    try {
      await inviteMember(collectionId, username);
      await get().loadMembers(collectionId);
    } catch (error) {
      set({ errorMessage: getErrorMessage(error, "Could not invite that user.") });
      throw error;
    }
  },

  loadMembers: async (collectionId) => {
    try {
      const members = await listCollectionMembers(collectionId);
      set((state) => ({
        membersByCollection: { ...state.membersByCollection, [collectionId]: members },
      }));
    } catch (error) {
      set({ errorMessage: getErrorMessage(error, "Could not load members.") });
    }
  },

  removeMember: async (collectionId, userId) => {
    const before = get().membersByCollection[collectionId] ?? [];
    set((state) => ({
      membersByCollection: {
        ...state.membersByCollection,
        [collectionId]: before.filter((m) => m.userId !== userId),
      },
    }));
    try {
      await removeMember(collectionId, userId);
    } catch (error) {
      set((state) => ({
        membersByCollection: { ...state.membersByCollection, [collectionId]: before },
        errorMessage: getErrorMessage(error, "Could not remove member."),
      }));
    }
  },

  acceptInvite: async (collectionId) => {
    const before = get().collections;
    set({
      collections: before.map((c) =>
        c.id === collectionId ? { ...c, myStatus: "active" } : c
      ),
    });
    try {
      await acceptInvite(collectionId);
    } catch (error) {
      set({
        collections: before,
        errorMessage: getErrorMessage(error, "Could not accept invite."),
      });
    }
  },

  declineInvite: async (collectionId) => {
    const before = get().collections;
    set({ collections: before.filter((c) => c.id !== collectionId) });
    try {
      await declineInvite(collectionId);
    } catch (error) {
      set({
        collections: before,
        errorMessage: getErrorMessage(error, "Could not decline invite."),
      });
    }
  },

  leaveCollection: async (collectionId) => {
    const before = get().collections;
    set((state) => ({
      collections: before.filter((c) => c.id !== collectionId),
      activeCollectionId:
        state.activeCollectionId === collectionId ? null : state.activeCollectionId,
    }));
    try {
      await leaveCollection(collectionId);
    } catch (error) {
      set({
        collections: before,
        errorMessage: getErrorMessage(error, "Could not leave collection."),
      });
    }
  },
}));
