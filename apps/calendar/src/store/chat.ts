/**
 * Chat Store for Calendar App
 *
 * Manages AI chat state with proper persona and conversation selection logic.
 * Implements the conversation system spec exactly.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface ChatStore {
  // Core state
  selectedPersonaId: string | null     // AI persona ID or NULL (PERSISTED)
  selectedConversationId: string | null // Thread/convo ID or NULL (PERSISTED)
  draftConversationId: string | null   // Generated ID for draft conversations (NOT PERSISTED)

  // Actions
  setSelectedPersonaId: (id: string | null) => void
  setSelectedConversationId: (id: string | null) => void
  setDraftConversationId: (id: string | null) => void
}


export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedPersonaId: null,
      selectedConversationId: null,
      draftConversationId: null,

      // Actions
      setSelectedPersonaId: (id: string | null) => {
        set({ selectedPersonaId: id })
      },

      setSelectedConversationId: (id: string | null) => {
        set({ selectedConversationId: id })
      },

      setDraftConversationId: (id: string | null) => {
        set({ draftConversationId: id })
      },
    }),
    {
      name: 'calendar-chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPersonaId: state.selectedPersonaId,
        selectedConversationId: state.selectedConversationId,
        // draftConversationId NOT persisted - defaults to null on reload
      }),
    }
  )
)

// Simple hooks to access store state

export function usePersonaSelection() {
  const selectedPersonaId = useChatStore(state => state.selectedPersonaId)
  const setSelectedPersonaId = useChatStore(state => state.setSelectedPersonaId)

  return {
    selectedPersonaId,
    setSelectedPersonaId
  }
}

export function useConversationSelection() {
  const selectedConversationId = useChatStore(state => state.selectedConversationId)
  const setSelectedConversationId = useChatStore(state => state.setSelectedConversationId)
  const draftConversationId = useChatStore(state => state.draftConversationId)
  const setDraftConversationId = useChatStore(state => state.setDraftConversationId)

  return {
    selectedConversationId,
    setSelectedConversationId,
    draftConversationId,
    setDraftConversationId
  }
}

