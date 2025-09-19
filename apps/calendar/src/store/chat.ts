/**
 * Dedicated Chat Store for Calendar App
 *
 * Manages AI chat state separately from calendar state with proper persistence.
 * Implements greeting logic, conversation selection, and loading states.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface ChatStore {
  // Core conversation state
  selectedConversationId: string | null
  selectedPersonaId: string | null

  // UI state (specific to chat)
  isChatLoading: boolean

  // Actions
  setSelectedConversationId: (id: string | null) => void
  setSelectedPersonaId: (id: string | null) => void
  // Data operations removed - use TanStack Query hooks instead
  clearConversation: () => void

  // UI state management
  setChatLoading: (loading: boolean) => void
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedConversationId: null,
      selectedPersonaId: null,
      isChatLoading: false,

      // Core actions
      setSelectedConversationId: (id: string | null) => {
        set({ selectedConversationId: id })
      },

      setSelectedPersonaId: (id: string | null) => {
        set({ selectedPersonaId: id })
      },

      // createNewConversation moved to TanStack Query hook

      clearConversation: () => {
        set({ selectedConversationId: null })
      },


      // UI state management
      setChatLoading: (loading: boolean) => {
        set({ isChatLoading: loading })
      },
    }),
    {
      name: 'calendar-chat-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist user preferences and conversation selection
      partialize: (state) => ({
        selectedConversationId: state.selectedConversationId,
        selectedPersonaId: state.selectedPersonaId,
        // Don't persist loading states - they should reset on reload
      }),
    }
  )
)

// Convenience hooks for specific chat store functionality

/**
 * Hook for managing conversation selection
 */
export function useConversationSelection() {
  const selectedConversationId = useChatStore(state => state.selectedConversationId)
  const setSelectedConversationId = useChatStore(state => state.setSelectedConversationId)
  const clearConversation = useChatStore(state => state.clearConversation)

  return {
    selectedConversationId,
    setSelectedConversationId,
    clearConversation
  }
}

/**
 * Hook for managing persona selection
 */
export function usePersonaSelection() {
  const selectedPersonaId = useChatStore(state => state.selectedPersonaId)
  const setSelectedPersonaId = useChatStore(state => state.setSelectedPersonaId)

  return {
    selectedPersonaId,
    setSelectedPersonaId
  }
}

/**
 * Hook for conversation creation - moved to TanStack Query hook
 * @deprecated Use useChatConversations hook for creation operations
 */

/**
 * Hook for managing loading states
 */
export function useChatLoading() {
  const isChatLoading = useChatStore(state => state.isChatLoading)
  const setChatLoading = useChatStore(state => state.setChatLoading)

  return {
    isChatLoading,
    setChatLoading
  }
}

