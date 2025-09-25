import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { getMessagesForChat } from '@/lib/mastra-api'
import type { UIMessage } from 'ai'

export function useConversationMessages(conversationId: string | null | undefined) {
  const { user, session } = useAuth()

  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async (): Promise<UIMessage[]> => {
      if (!conversationId || !user?.id) {
        return []
      }

      // Use Mastra API service with JWT authentication - always fetch exactly 10 most recent messages
      // Returns proper AI SDK v5 UIMessage format with parts array
      const messages = await getMessagesForChat(conversationId, 10, session?.access_token)
      return messages
    },
    enabled: !!conversationId && !!user?.id && !conversationId.startsWith('new-conversation-'),
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
  })
}

// parseMessageContent function removed - now handled in Mastra API service layer