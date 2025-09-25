/**
 * Conversation Selection Logic Hook
 *
 * Implements the conversation selection fallback hierarchy from the spec:
 * 1. Persisted selection from localStorage
 * 2. Most recent conversation for current persona
 * 3. New conversation experience
 */

import { useEffect } from 'react'
import { useChatConversations } from '@/hooks/use-chat-conversations'
import { useConversationSelection } from '@/store/chat'
import { getBestConversationForPersona } from '@/lib/conversation-helpers'

interface UseConversationSelectionLogicProps {
  selectedPersonaId: string | null
}

export function useConversationSelectionLogic({ selectedPersonaId }: UseConversationSelectionLogicProps) {
  const { conversations, isLoading } = useChatConversations()
  const { selectedConversationId, setSelectedConversationId } = useConversationSelection()

  // Auto-select conversation when persona changes or conversations load
  useEffect(() => {
    // Don't run until conversations are loaded and we have a persona
    if (isLoading || !selectedPersonaId) return

    // If we already have a valid conversation selection, check if it belongs to current persona
    if (selectedConversationId) {
      const conversationExists = conversations.some(c => c.id === selectedConversationId)
      if (conversationExists) {
        const currentBelongsToPersona = conversations.some(c =>
          c.id === selectedConversationId &&
          c.metadata?.personaId === selectedPersonaId
        )

        if (currentBelongsToPersona) {
          return // Keep current selection
        }
      }
    }

    // Apply fallback hierarchy
    // 1. Try most recent conversation for current persona
    const mostRecentForPersona = getBestConversationForPersona(conversations, selectedPersonaId)

    if (mostRecentForPersona) {
      // Found existing conversation for this persona
      setSelectedConversationId(mostRecentForPersona)
    } else {
      // 2. No conversations exist for this persona - leave as null (shows blank/new state)
      setSelectedConversationId(null)
    }
  }, [
    conversations,
    isLoading,
    selectedPersonaId,
    selectedConversationId,
    setSelectedConversationId
  ])

  return {
    selectedConversationId,
    conversations,
    isLoading
  }
}