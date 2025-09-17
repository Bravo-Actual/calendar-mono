import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export interface ConversationMessage {
  id: string
  thread_id: string
  role: 'user' | 'assistant'
  content: any
  createdAt: string
}

export function useConversationMessages(conversationId: string | null | undefined) {
  const { user } = useAuth()

  console.log('🚨 [useConversationMessages] Hook called with:', { conversationId, userId: user?.id })

  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!conversationId || !user?.id) {
        console.log('🔍 [Messages] Skipping fetch - missing conversationId or userId')
        return []
      }

      console.log('🔍 [Messages] EXECUTING QUERY - Fetching messages for conversation:', conversationId)

      const { data: messages, error } = await supabase
        .from('mastra_messages')
        .select('id, thread_id, role, content, "createdAt"')
        .eq('thread_id', conversationId)
        .order('createdAt', { ascending: false }) // Most recent first
        .limit(10) // Most recent 10 messages

      if (error) {
        console.error('Error fetching conversation messages:', error)
        throw error
      }

      console.log('🔍 [Messages] Fetched', messages?.length || 0, 'messages')

      // Convert to format compatible with useChat and reverse to chronological order
      const parsedMessages = (messages || [])
        .reverse() // Put in chronological order (oldest first)
        .map(msg => {
          const parsedContent = parseMessageContent(msg.content)
          console.log('🔍 [Messages] Raw content:', msg.content)
          console.log('🔍 [Messages] Parsed content:', parsedContent)
          return {
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: parsedContent,
            createdAt: msg.createdAt
          }
        })

      console.log('🔍 [Messages] Final parsed messages:', parsedMessages)
      return parsedMessages
    },
    enabled: !!conversationId && !!user?.id,
  })
}

function parseMessageContent(content: any): string {
  if (typeof content === 'string') {
    try {
      // Try to parse as JSON first (Mastra stores as JSON string)
      const parsed = JSON.parse(content)

      // Handle Mastra message format with root-level content field
      if (parsed?.content && typeof parsed.content === 'string') {
        return parsed.content
      }

      // Handle parts array format
      if (parsed?.parts && Array.isArray(parsed.parts)) {
        const textPart = parsed.parts.find((p: any) => p.type === 'text')
        if (textPart?.text) {
          return textPart.text
        }
      }
    } catch {
      // If it's not JSON, treat as plain string
      return content
    }
  }

  // Handle already parsed object
  if (content?.content && typeof content.content === 'string') {
    return content.content
  }

  // Handle legacy/simple formats
  if (content?.text) {
    return content.text
  }

  // Handle parts array format
  if (content?.parts && Array.isArray(content.parts)) {
    const textPart = content.parts.find((p: any) => p.type === 'text')
    if (textPart?.text) {
      return textPart.text
    }
  }

  return ''
}