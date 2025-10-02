import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as CalendarAI from '@/lib/calendar-ai-api';
import { usePersonaSelection } from '@/store/chat';

export interface ChatConversation {
  id: string;
  title?: string | null;
  userId: string;
  personaId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export function useChatConversations() {
  const { user, session } = useAuth();
  const { selectedPersonaId } = usePersonaSelection();
  const queryClient = useQueryClient();

  const {
    data: conversations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['chat-conversations', user?.id, selectedPersonaId],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }
      if (!selectedPersonaId) {
        return []; // Don't fetch without a persona selected
      }

      try {
        // Use calendar-ai API service with JWT authentication
        const threads = await CalendarAI.getThreads(
          user.id,
          selectedPersonaId,
          session?.access_token
        );

        // Map threads to ChatConversation format
        const mappedConversations: ChatConversation[] = threads.map((thread) => ({
          id: thread.thread_id,
          title: thread.title || null,
          userId: thread.user_id,
          personaId: thread.persona_id,
          createdAt: thread.created_at,
          metadata: thread.metadata,
        }));

        // Sort by creation time (most recent first)
        const sortedConversations = mappedConversations.sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return sortedConversations;
      } catch (error) {
        console.error('Error in useChatConversations:', error);
        throw error;
      }
    },
    enabled: !!user && !!session && !!selectedPersonaId,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchInterval: false, // Disable automatic refetching
  });

  const updateConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      if (!session?.access_token) throw new Error('No authentication token available');
      await CalendarAI.updateThread(id, { title }, session.access_token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!session?.access_token) throw new Error('No authentication token available');
      await CalendarAI.deleteThread(id, session.access_token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async ({
      title = 'New Conversation',
      personaId,
    }: {
      title?: string;
      personaId?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (!session?.access_token) throw new Error('No authentication token available');

      // Create thread directly via calendar-ai API
      const thread = await CalendarAI.createThread(
        {
          userId: user.id,
          personaId,
          title,
          metadata: {},
        },
        session.access_token
      );

      return {
        id: thread.thread_id,
        title: thread.title,
        userId: thread.user_id,
        personaId: thread.persona_id,
        createdAt: thread.created_at,
        metadata: thread.metadata,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  const updateConversation = useCallback(
    (id: string, title: string) => {
      return updateConversationMutation.mutateAsync({ id, title });
    },
    [updateConversationMutation]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      return deleteConversationMutation.mutateAsync(id);
    },
    [deleteConversationMutation]
  );

  const createConversation = useCallback(
    (options?: { title?: string; personaId?: string }) => {
      return createConversationMutation.mutateAsync(options || {});
    },
    [createConversationMutation]
  );

  const generateNewConversationId = useCallback(() => {
    // Simply invalidate queries to get a fresh "new conversation" UUID
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
  }, [queryClient]);

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
  };
}
