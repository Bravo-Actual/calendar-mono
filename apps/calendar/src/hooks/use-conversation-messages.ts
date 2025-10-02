import { useQuery } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import { useAuth } from '@/contexts/AuthContext';
import { getMessages } from '@/lib/calendar-ai-api';

export function useConversationMessages(conversationId: string | null | undefined) {
  const { user, session } = useAuth();

  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async (): Promise<UIMessage[]> => {
      if (!conversationId || !user?.id) {
        return [];
      }

      // Use calendar-ai API with JWT authentication
      // Returns AI SDK UIMessage format with parts array
      const messages = await getMessages(conversationId, 50, session?.access_token);
      return messages;
    },
    enabled: !!conversationId && !!user && !!session,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchInterval: false, // Disable automatic refetching
  });
}
