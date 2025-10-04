import { useQuery } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import { useAuth } from '@/contexts/AuthContext';
import { getMessagesForChat } from '@/lib/mastra-api';

/**
 * Hook to fetch messages for an existing conversation.
 * Only call this for existing threads - pass null for new threads.
 * Fetches fresh data each time a conversation is selected.
 *
 * @param conversationId - The conversation/thread ID (null for new threads)
 */
export function useConversationMessages(
  conversationId: string | null | undefined,
  _greetingMessage?: string | null // Kept for backward compatibility, not used
) {
  const { user, session } = useAuth();

  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async (): Promise<UIMessage[]> => {
      if (!conversationId || !user?.id) {
        return [];
      }

      // Fetch messages from Mastra API
      const messages = await getMessagesForChat(conversationId, 10, session?.access_token);
      return messages;
    },
    enabled: !!conversationId && !!user && !!session,
  });
}

// parseMessageContent function removed - now handled in Mastra API service layer
