import { useQuery } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import { useAuth } from '@/contexts/AuthContext';
import { getMessagesForChat } from '@/lib/mastra-api';

export function useConversationMessages(conversationId: string | null | undefined) {
  const { user, session } = useAuth();

  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async (): Promise<UIMessage[]> => {
      if (!conversationId || !user?.id) {
        return [];
      }

      // Use Mastra API service with JWT authentication - always fetch exactly 10 most recent messages
      // Returns proper AI SDK v5 UIMessage format with parts array
      const messages = await getMessagesForChat(conversationId, 10, session?.access_token);
      return messages;
    },
    enabled: !!conversationId && !!user && !!session,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchInterval: false, // Disable automatic refetching
  });
}

// parseMessageContent function removed - now handled in Mastra API service layer
