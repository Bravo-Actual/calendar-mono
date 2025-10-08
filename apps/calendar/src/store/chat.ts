/**
 * Chat Store for Calendar App
 *
 * Manages AI chat state with proper persona and conversation selection logic.
 * Implements the conversation system spec exactly.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ClientPersona } from '@/lib/data-v2';

export interface ChatStore {
  // Core state
  selectedPersona: ClientPersona | null; // Full persona object (PERSISTED)
  selectedThreadId: string | null; // Thread ID (new or existing) (PERSISTED)
  selectedThreadIsNew: boolean; // True for new thread, False for existing (PERSISTED)

  // Runtime state (NOT PERSISTED)
  selectedThreadIsLoaded: boolean; // True when messages have been loaded into useChat

  // Actions
  setSelectedPersona: (persona: ClientPersona | null) => void;
  setSelectedThreadId: (id: string | null) => void;
  setSelectedThreadIsNew: (isNew: boolean) => void;
  setSelectedThreadIsLoaded: (isLoaded: boolean) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, _get) => ({
      // Initial state
      selectedPersona: null,
      selectedThreadId: null,
      selectedThreadIsNew: false,
      selectedThreadIsLoaded: false,

      // Actions
      setSelectedPersona: (persona: ClientPersona | null) => {
        // Clear thread selection when changing personas - auto-select will handle it
        set({
          selectedPersona: persona,
          selectedThreadId: null,
          selectedThreadIsNew: false,
          selectedThreadIsLoaded: false,
        });
      },

      setSelectedThreadId: (id: string | null) => {
        set({ selectedThreadId: id });
      },

      setSelectedThreadIsNew: (isNew: boolean) => {
        set({ selectedThreadIsNew: isNew });
      },

      setSelectedThreadIsLoaded: (isLoaded: boolean) => {
        set({ selectedThreadIsLoaded: isLoaded });
      },
    }),
    {
      name: 'calendar-chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPersona: state.selectedPersona,
        selectedThreadId: state.selectedThreadId,
        selectedThreadIsNew: state.selectedThreadIsNew,
        // selectedThreadIsLoaded NOT persisted - runtime only
      }),
    }
  )
);

// Simple hooks to access store state

export function usePersonaSelection() {
  const selectedPersona = useChatStore((state) => state.selectedPersona);
  const setSelectedPersona = useChatStore((state) => state.setSelectedPersona);

  return {
    selectedPersona,
    selectedPersonaId: selectedPersona?.id || null,
    setSelectedPersona,
  };
}

export function useThreadSelection() {
  const selectedThreadId = useChatStore((state) => state.selectedThreadId);
  const setSelectedThreadId = useChatStore((state) => state.setSelectedThreadId);
  const selectedThreadIsNew = useChatStore((state) => state.selectedThreadIsNew);
  const setSelectedThreadIsNew = useChatStore((state) => state.setSelectedThreadIsNew);
  const selectedThreadIsLoaded = useChatStore((state) => state.selectedThreadIsLoaded);
  const setSelectedThreadIsLoaded = useChatStore((state) => state.setSelectedThreadIsLoaded);

  return {
    selectedThreadId,
    setSelectedThreadId,
    selectedThreadIsNew,
    setSelectedThreadIsNew,
    selectedThreadIsLoaded,
    setSelectedThreadIsLoaded,
  };
}
