/**
 * Chat Store for Calendar App
 *
 * Manages AI chat state with proper persona and conversation selection logic.
 * Implements the conversation system spec exactly.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ChatStore {
  // Core state
  selectedPersonaId: string | null; // AI persona ID or NULL (PERSISTED)
  selectedConversationId: string | null; // Thread/convo ID (new or existing) (PERSISTED)

  // Thread tracking state (NOT PERSISTED)
  threadIsNew: boolean; // True for draft/new, False for existing

  // Actions
  setSelectedPersonaId: (id: string | null) => void;
  setSelectedConversationId: (id: string | null) => void;
  setThreadIsNew: (isNew: boolean) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, _get) => ({
      // Initial state
      selectedPersonaId: null,
      selectedConversationId: null,
      threadIsNew: false,

      // Actions
      setSelectedPersonaId: (id: string | null) => {
        // Clear conversation selection when changing personas - auto-select will handle it
        set({
          selectedPersonaId: id,
          selectedConversationId: null,
        });
      },

      setSelectedConversationId: (id: string | null) => {
        set({ selectedConversationId: id });
      },

      setThreadIsNew: (isNew: boolean) => {
        set({ threadIsNew: isNew });
      },
    }),
    {
      name: 'calendar-chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPersonaId: state.selectedPersonaId,
        selectedConversationId: state.selectedConversationId,
        // threadLoadState, threadIsNew NOT persisted
      }),
    }
  )
);

// Simple hooks to access store state

export function usePersonaSelection() {
  const selectedPersonaId = useChatStore((state) => state.selectedPersonaId);
  const setSelectedPersonaId = useChatStore((state) => state.setSelectedPersonaId);

  return {
    selectedPersonaId,
    setSelectedPersonaId,
  };
}

export function useConversationSelection() {
  const selectedConversationId = useChatStore((state) => state.selectedConversationId);
  const setSelectedConversationId = useChatStore((state) => state.setSelectedConversationId);
  const threadIsNew = useChatStore((state) => state.threadIsNew);
  const setThreadIsNew = useChatStore((state) => state.setThreadIsNew);

  return {
    selectedConversationId,
    setSelectedConversationId,
    threadIsNew,
    setThreadIsNew,
  };
}
