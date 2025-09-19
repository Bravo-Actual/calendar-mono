import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useCallback, useRef } from 'react'
import {
  getThreadsWithLatestMessage,
  createThreadWithMetadata,
  MastraAPI,
} from '@/lib/mastra-api'
import { usePersonaSelection } from '@/store/chat'

export interface ChatConversation {
  id: string
  title?: string | null
  resourceId: string // Changed from resource_id to match mastra_threads
  createdAt: string // Changed from created_at to match mastra_threads
  latest_message?: {
    content: unknown
    role: string
    createdAt: string // Changed from created_at to match mastra_messages
  }
  isNew?: boolean // Flag to identify the "new conversation" entry
}

export function useChatConversations() {
  const { user, session } = useAuth()
  const { selectedPersonaId } = usePersonaSelection()
  const queryClient = useQueryClient()

  const { data: conversations = [], isLoading, error, refetch } = useQuery({
    queryKey: ['chat-conversations', user?.id, selectedPersonaId],
    queryFn: async () => {
      if (!user?.id) return []

      try {
        // Use new Mastra API service layer with JWT authentication
        const threads = await getThreadsWithLatestMessage(user.id, selectedPersonaId, session?.access_token)

        // Sort by latest message time, then by thread creation time
        const sortedConversations = threads.sort((a, b) => {
          const aTime = a.latest_message?.createdAt || a.createdAt
          const bTime = b.latest_message?.createdAt || b.createdAt
          return new Date(bTime).getTime() - new Date(aTime).getTime()
        })

        // Always prepend a "new conversation" entry - generate fresh UUID each time for simplicity
        const newConversation: ChatConversation = {
          id: crypto.randomUUID(),
          title: null,
          resourceId: user.id,
          createdAt: new Date().toISOString(),
          isNew: true
        }

        return [newConversation, ...sortedConversations]
      } catch (error) {
        console.error('Failed to fetch conversations:', error)
        throw error
      }
    },
    enabled: !!user?.id,
  })


  const updateConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      // Skip temporary conversations
      if (id.startsWith('temp_')) return
      // Ensure we have a session
      if (!session?.access_token) throw new Error('No authentication token available')

      // Use Mastra API with JWT authentication
      await MastraAPI.updateThread(id, { title }, session.access_token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    },
  })

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      // Skip temporary conversations
      if (id.startsWith('temp_')) return
      // Ensure we have a session
      if (!session?.access_token) throw new Error('No authentication token available')

      // Use Mastra API with JWT authentication - it handles message deletion automatically
      await MastraAPI.deleteThread(id, session.access_token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    },
  })

  const createConversationMutation = useMutation({
    mutationFn: async ({ title = 'New Conversation', personaId }: { title?: string; personaId?: string }) => {
      if (!user?.id) throw new Error('User not authenticated')

      // Create a thread object with new UUID - Mastra will create the actual thread when first message is sent
      const metadata = personaId ? { personaId } : {}
      const thread = {
        id: crypto.randomUUID(),
        title,
        resourceId: user.id,
        createdAt: new Date().toISOString(),
        metadata
      }

      return thread
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    },
  })


  const updateConversation = useCallback(
    (id: string, title: string) => {
      return updateConversationMutation.mutateAsync({ id, title })
    },
    [updateConversationMutation]
  )

  const deleteConversation = useCallback(
    (id: string) => {
      return deleteConversationMutation.mutateAsync(id)
    },
    [deleteConversationMutation]
  )

  const createConversation = useCallback(
    (options?: { title?: string; personaId?: string }) => {
      return createConversationMutation.mutateAsync(options || {})
    },
    [createConversationMutation]
  )

  const generateNewConversationId = useCallback(() => {
    // Simply invalidate queries to get a fresh "new conversation" UUID
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
  }, [queryClient])

  return {
    conversations,
    isLoading,
    error,
    refetch,
    updateConversation,
    deleteConversation,
    createConversation,
    generateNewConversationId,
    isUpdating: updateConversationMutation.isPending,
    isDeleting: deleteConversationMutation.isPending,
    isCreating: createConversationMutation.isPending,
  }
}