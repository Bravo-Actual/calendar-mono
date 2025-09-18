import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useCallback } from 'react'

export interface ChatConversation {
  id: string
  title?: string | null
  resourceId: string // Changed from resource_id to match mastra_threads
  createdAt: string // Changed from created_at to match mastra_threads
  metadata?: Record<string, unknown> | string | null
  latest_message?: {
    content: string | Record<string, unknown>
    role: string
    createdAt: string // Changed from created_at to match mastra_messages
  }
}

export function useChatConversations(selectedPersonaId?: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: conversations = [], isLoading, error, refetch } = useQuery({
    queryKey: ['chat-conversations', user?.id, selectedPersonaId],
    queryFn: async () => {
      if (!user?.id) return []

      // Get threads for the current user from Mastra tables, ordered by most recent
      const { data: threads, error: threadsError } = await supabase
        .from('mastra_threads')
        .select(`
          id,
          title,
          "resourceId",
          "createdAt",
          metadata
        `)
        .eq('resourceId', user.id) // Filter by user ID as resource
        .order('createdAt', { ascending: false })

      if (threadsError) throw threadsError

      // Filter threads by persona if one is selected
      const filteredThreads = selectedPersonaId
        ? threads.filter(thread => {
            try {
              const metadata = typeof thread.metadata === 'string'
                ? JSON.parse(thread.metadata)
                : thread.metadata;
              return metadata?.personaId === selectedPersonaId;
            } catch (error) {
              console.warn('Failed to parse thread metadata:', error);
              return false;
            }
          })
        : threads;

      // For each filtered thread, get the latest message to use as snippet
      const conversationsWithMessages = await Promise.all(
        filteredThreads.map(async (thread) => {
          const { data: latestMessage, error: messageError } = await supabase
            .from('mastra_messages')
            .select('content, role, "createdAt"')
            .eq('thread_id', thread.id)
            .order('createdAt', { ascending: false })
            .limit(1)
            .maybeSingle() // Use maybeSingle instead of single to handle no results

          // Log any message fetch errors but don't throw
          if (messageError && messageError.code !== 'PGRST116') {
            console.warn('Error fetching latest message for thread', thread.id, messageError)
          }

          return {
            ...thread,
            latest_message: latestMessage || undefined
          }
        })
      )

      // Sort by latest message time, then by thread creation time
      return conversationsWithMessages.sort((a, b) => {
        const aTime = a.latest_message?.createdAt || a.createdAt
        const bTime = b.latest_message?.createdAt || b.createdAt
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
    },
    enabled: !!user?.id,
  })

  const createConversationMutation = useMutation({
    mutationFn: async ({ title, personaId }: { title?: string; personaId?: string }) => {
      // Generate a proper UUID that Mastra will use as the actual thread ID
      const threadId = crypto.randomUUID()
      return {
        id: threadId,
        title: title || 'New conversation',
        resourceId: user?.id || '',
        createdAt: new Date().toISOString(),
        metadata: JSON.stringify({ personaId })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    },
  })

  const updateConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      // Skip temporary conversations
      if (id.startsWith('temp_')) return

      const { error } = await supabase
        .from('mastra_threads')
        .update({ title })
        .eq('id', id)
        .eq('resourceId', user?.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    },
  })

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      // Skip temporary conversations
      if (id.startsWith('temp_')) return

      // Delete messages first (since there are no foreign key constraints)
      const { error: messagesError } = await supabase
        .from('mastra_messages')
        .delete()
        .eq('thread_id', id)

      if (messagesError) throw messagesError

      // Then delete the thread
      const { error: threadError } = await supabase
        .from('mastra_threads')
        .delete()
        .eq('id', id)
        .eq('resourceId', user?.id)

      if (threadError) throw threadError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    },
  })

  const createConversation = useCallback(
    (options?: { title?: string; personaId?: string }) => {
      return createConversationMutation.mutateAsync(options || {})
    },
    [createConversationMutation]
  )

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

  return {
    conversations,
    isLoading,
    error,
    refetch,
    createConversation,
    updateConversation,
    deleteConversation,
    isCreating: createConversationMutation.isPending,
    isUpdating: updateConversationMutation.isPending,
    isDeleting: deleteConversationMutation.isPending,
  }
}