/**
 * Chat Store for Calendar App
 *
 * Manages AI chat state with proper persona and conversation selection logic.
 * Implements the conversation system spec exactly.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface ChatStore {
  // Core state - matches spec exactly
  selectedPersonaId: string | null     // AI persona ID or NULL
  selectedConversationId: string | null // Thread/convo ID or NULL
  isNewConversation: boolean           // Track if current conversation is new

  // UI state
  isChatLoading: boolean

  // Actions
  setSelectedPersonaId: (id: string | null) => void
  setSelectedConversationId: (id: string | null) => void
  setIsNewConversation: (isNew: boolean) => void
  setChatLoading: (loading: boolean) => void
}


export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedPersonaId: null,
      selectedConversationId: null,
      isNewConversation: false,
      isChatLoading: false,

      // Core actions
      setSelectedPersonaId: (id: string | null) => {
        set({ selectedPersonaId: id })
      },

      setSelectedConversationId: (id: string | null) => {
        set({ selectedConversationId: id })
      },

      setIsNewConversation: (isNew: boolean) => {
        set({ isNewConversation: isNew })
      },

      // UI state management
      setChatLoading: (loading: boolean) => {
        set({ isChatLoading: loading })
      },
    }),
    {
      name: 'calendar-chat-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist core state - not UI state
      partialize: (state) => ({
        selectedPersonaId: state.selectedPersonaId,
        selectedConversationId: state.selectedConversationId,
        isNewConversation: state.isNewConversation,
      }),
    }
  )
)

// Convenience hooks for specific chat store functionality

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
 * Hook for managing conversation selection
 */
export function useConversationSelection() {
  const selectedConversationId = useChatStore(state => state.selectedConversationId)
  const setSelectedConversationId = useChatStore(state => state.setSelectedConversationId)
  const isNewConversation = useChatStore(state => state.isNewConversation)
  const setIsNewConversation = useChatStore(state => state.setIsNewConversation)

  // Helper methods for conversation flow
  const startNewConversation = () => {
    const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    console.log('Starting new conversation with ID:', newId)
    setSelectedConversationId(newId)
    setIsNewConversation(true)
  }

  const clearNewConversation = () => {
    setSelectedConversationId(null)
    setIsNewConversation(false)
  }

  return {
    selectedConversationId,
    setSelectedConversationId,
    isNewConversation,
    setIsNewConversation,
    startNewConversation,
    clearNewConversation
  }
}

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

