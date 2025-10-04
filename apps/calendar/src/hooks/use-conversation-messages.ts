import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import { useAuth } from '@/contexts/AuthContext';
import { getMessagesForChat } from '@/lib/mastra-api';

/**
 * Hook to get messages for a conversation, handling both new and existing threads.
 * Returns greeting message for new threads, fetched messages for existing threads.
 *
 * @param conversationId - The conversation/thread ID
 * @param threadIsNew - Whether this is a new conversation
 * @param greetingMessage - Optional greeting message for new conversations
 */
export function useConversationMessages(
  conversationId: string | null | undefined,
  threadIsNew: boolean,
  greetingMessage?: string | null
) {
  const { user, session } = useAuth();

  // Fetch messages only for existing conversations
  const query = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async (): Promise<UIMessage[]> => {
      if (!conversationId || !user?.id) {
        return [];
      }

      // Fetch messages from Mastra API
      const messages = await getMessagesForChat(conversationId, 10, session?.access_token);
      return messages;
    },
    enabled: !!conversationId && !!user && !!session && !threadIsNew,
  });

  // Build messages: greeting for new threads, fetched messages for existing
  const messages = useMemo(() => {
    console.log('🔍 useConversationMessages building messages:', {
      conversationId,
      threadIsNew,
      hasGreeting: !!greetingMessage,
      queryLoading: query.isLoading,
      queryDataLength: query.data?.length || 0,
    });

    // New conversation with greeting
    if (threadIsNew && greetingMessage) {
      console.log('✅ Returning greeting message for new thread');
      return [{
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: greetingMessage }],
      }];
    }

    // Existing conversation - return fetched messages (or empty if loading)
    const result = query.data || [];
    console.log('📦 Returning fetched messages:', result.length);
    return result;
  }, [conversationId, threadIsNew, greetingMessage, query.isLoading, query.data]);

  const isReady = threadIsNew || !query.isLoading;
  console.log('📊 useConversationMessages result:', {
    messagesCount: messages.length,
    isReady,
    queryLoading: query.isLoading,
  });

  return {
    ...query,
    data: messages,
    isReady,
  };
}

// parseMessageContent function removed - now handled in Mastra API service layer
