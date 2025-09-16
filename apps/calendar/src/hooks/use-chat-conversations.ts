import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useCallback } from 'react'

export interface ChatConversation {
  id: string
  title?: string | null
  resourceId: string // Changed from resource_id to match mastra_threads
  createdAt: string // Changed from created_at to match mastra_threads
  latest_message?: {
    content: any
    role: string
    createdAt: string // Changed from created_at to match mastra_messages
  }
}

export function useChatConversations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ['chat-conversations', user?.id],
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

      // For each thread, get the latest message to use as snippet
      const conversationsWithMessages = await Promise.all(
        threads.map(async (thread) => {
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
      // Instead of creating a thread directly, we'll return a temporary conversation object
      // The actual thread will be created by Mastra when the first message is sent
      const tempId = `temp_${Date.now()}`
      return {
        id: tempId,
        title: title || 'New conversation',
        resourceId: user?.id || '',
        createdAt: new Date().toISOString(),
        metadata: JSON.stringify({ personaId, isTemporary: true })
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

      const { error } = await supabase
        .from('mastra_threads')
        .delete()
        .eq('id', id)
        .eq('resourceId', user?.id)

      if (error) throw error
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
    createConversation,
    updateConversation,
    deleteConversation,
    isCreating: createConversationMutation.isPending,
    isUpdating: updateConversationMutation.isPending,
    isDeleting: deleteConversationMutation.isPending,
  }
}