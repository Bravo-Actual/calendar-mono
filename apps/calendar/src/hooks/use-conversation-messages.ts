import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Message } from 'ai'

export interface ConversationMessage {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: any
  createdAt: string
}

export function useConversationMessages(conversationId?: string | null) {
  const { user } = useAuth()

  const { data: messages = [], isLoading, error, refetch } = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!conversationId || !user?.id) return []

      // Fetch messages for the conversation from mastra_messages table
      const { data: rawMessages, error: messagesError } = await supabase
        .from('mastra_messages')
        .select('id, thread_id, role, content, "createdAt"')
        .eq('thread_id', conversationId)
        .order('createdAt', { ascending: true }) // Oldest first for proper chat order
        .limit(20) // Get last 20 messages

      if (messagesError) {
        console.error('Error fetching conversation messages:', messagesError)
        throw messagesError
      }

      // Convert to AI SDK Message format
      const formattedMessages: Message[] = rawMessages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: formatMessageContent(msg.content),
        createdAt: new Date(msg.createdAt),
      }))

      console.log(`📝 Loaded ${formattedMessages.length} messages for conversation:`, conversationId)
      return formattedMessages
    },
    enabled: !!conversationId && !!user?.id,
  })

  return {
    messages,
    isLoading,
    error,
    refetch,
  }
}

// Helper function to format message content for AI SDK compatibility
function formatMessageContent(content: any): string {
  if (typeof content === 'string') {
    return content
  }

  if (content?.text) {
    return content.text
  }

  if (content?.parts && Array.isArray(content.parts)) {
    const textParts = content.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('')
    return textParts
  }

  // Try to extract any text content
  if (typeof content === 'object') {
    try {
      return JSON.stringify(content)
    } catch {
      return 'Message content unavailable'
    }
  }

  return 'Message content unavailable'
}