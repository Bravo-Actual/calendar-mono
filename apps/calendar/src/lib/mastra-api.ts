/**
 * Mastra Memory API Client for Calendar App
 *
 * Uses the official Mastra Client SDK for conversation and message management.
 * Provides a clean interface that wraps Mastra SDK methods with proper types.
 */

import { MastraClient } from '@mastra/client-js'
import type { UIMessage } from 'ai'

// Mastra thread types (copied since they're not exported from @mastra/client-js)
interface StorageThreadType {
  id: string
  title?: string | null
  resourceId: string
  createdAt: string
  updatedAt?: string
  metadata?: Record<string, any>
  agentId?: string
}

// Create MastraClient with JWT authentication (following official Mastra pattern)
const createMastraClient = (authToken?: string) => {
  return new MastraClient({
    baseUrl: process.env.NEXT_PUBLIC_AGENT_URL!,
    headers: authToken ? {
      Authorization: `Bearer ${authToken}`
    } : undefined
  })
}

// Default client instance (will be replaced with authenticated calls)
const mastraClient = createMastraClient()

// Export our thread type
export type MastraThread = StorageThreadType

export interface ThreadWithLatestMessage extends StorageThreadType {
  latest_message?: {
    content: string | Record<string, unknown>
    role: string
    createdAt: string
  }
}

class MastraAPIError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message)
    this.name = 'MastraAPIError'
  }
}

/**
 * Create a new thread with metadata (persona information)
 * Uses official Mastra Client SDK createMemoryThread method
 */
export async function createThreadWithMetadata(
  resourceId: string,
  title: string,
  metadata: Record<string, unknown> = {},
  authToken?: string
): Promise<MastraThread> {
  try {
    const client = createMastraClient(authToken)
    const thread = await client.createMemoryThread({
      resourceId,
      agentId: 'dynamicPersonaAgent', // The agent key registered in mastra/index.ts
      title,
      metadata,
    })
    return thread
  } catch (error) {
    throw new MastraAPIError('Failed to create thread', error)
  }
}

/**
 * Get threads for a user, optionally filtered by persona, with latest message
 * Uses official Mastra Client SDK getMemoryThreads method
 */
export async function getThreadsWithLatestMessage(
  resourceId: string,
  personaId?: string,
  authToken?: string
): Promise<ThreadWithLatestMessage[]> {
  try {
    const client = createMastraClient(authToken)
    // Get threads using official SDK - requires both resourceId and agentId
    const threads = await client.getMemoryThreads({
      resourceId,
      agentId: 'dynamicPersonaAgent', // The agent key registered in mastra/index.ts
      orderBy: 'updatedAt',
      sortDirection: 'DESC'
    })

    // Filter by persona if specified
    const filteredThreads = personaId
      ? threads.filter(thread => {
          try {
            // Handle both string and object metadata formats
            const metadata = typeof thread.metadata === 'string'
              ? JSON.parse(thread.metadata)
              : thread.metadata
            return metadata?.personaId === personaId
          } catch (error) {
              return false
          }
        })
      : threads

    // Get latest message for each thread using the memory thread instance
    const threadsWithMessages = await Promise.all(
      filteredThreads.map(async (thread) => {
        try {
          const memoryThread = client.getMemoryThread(thread.id, 'dynamicPersonaAgent')
          const { messages } = await memoryThread.getMessages({ limit: 1 })

          const latestMessage = messages[0]

          return {
            ...thread,
            latest_message: latestMessage ? {
              content: latestMessage.content,
              role: latestMessage.role,
              createdAt: latestMessage.createdAt
            } : undefined
          }
        } catch (error) {
          return thread as ThreadWithLatestMessage
        }
      })
    )

    return threadsWithMessages
  } catch (error) {
    throw new MastraAPIError('Failed to get threads', error)
  }
}

/**
 * Get messages for a specific thread, formatted for AI SDK v5 UIMessage compatibility
 * Uses official Mastra Client SDK getMemoryThread and returns proper UIMessage types
 */
export async function getMessagesForChat(
  threadId: string,
  limit: number = 50,
  authToken?: string
): Promise<UIMessage[]> {
  try {
    const client = createMastraClient(authToken)
    const memoryThread = client.getMemoryThread(threadId, 'dynamicPersonaAgent')
    // Get messages in V2 format which is compatible with AI SDK UIMessage
    const { messages } = await memoryThread.getMessages({ limit, format: 'v2' })


    // Sort messages chronologically (oldest first) since Mastra API doesn't support order parameter
    const sortedMessages = messages.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime; // Ascending order (oldest first)
    });


    // V2 format should be compatible with AI SDK UIMessage - use it directly
    return sortedMessages.map(msg => {

      // V2 format content should have { format: 2, parts: [...] } structure
      let parts = []

      if (msg.content && typeof msg.content === 'object') {
        if (msg.content.format === 2) {
          // Transform V2 parts to be AI SDK UIMessage compatible
          parts = (msg.content.parts || []).map((part: unknown) => {
            // Handle tool result parts
            if (part.type === 'tool-result') {
              return {
                ...part,
                type: 'tool-result',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                result: part.result
                // No state for historical messages
              }
            }
            // Handle tool call parts
            if (part.type === 'tool-call') {
              return {
                ...part,
                type: 'tool-call',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args
                // No state for historical messages
              }
            }
            // Return other parts as-is
            return part
          })
        } else if (Array.isArray(msg.content)) {
          // Handle array content directly (newer Mastra format)
          parts = msg.content.map((part: unknown) => {
            // Handle tool result parts
            if (part.type === 'tool-result') {
              return {
                ...part,
                type: 'tool-result',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                result: part.result
                // No state for historical messages
              }
            }
            // Handle tool call parts
            if (part.type === 'tool-call') {
              return {
                ...part,
                type: 'tool-call',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args
                // No state for historical messages
              }
            }
            // Return other parts as-is
            return part
          })
        }
      } else if (typeof msg.content === 'string') {
        // Fallback for string content
        parts = [{
          id: `${msg.id}-text-part`,
          type: 'text',
          text: msg.content,
          state: 'done' as const
        }]
      } else {
        // Fallback for other formats
        parts = [{
          id: `${msg.id}-text-part`,
          type: 'text',
          text: JSON.stringify(msg.content),
          state: 'done' as const
        }]
      }

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts: parts,
        metadata: {
          createdAt: msg.createdAt,
          threadId: msg.threadId
        }
      }
    })
  } catch (error) {
    throw new MastraAPIError('Failed to get messages', error)
  }
}

/**
 * Add a message to a thread
 * Uses official Mastra Client SDK saveMessageToMemory method
 */
export async function addMessageToThread(
  threadId: string,
  role: 'user' | 'assistant',
  content: string,
  authToken?: string
) {
  try {
    const client = createMastraClient(authToken)
    const savedMessages = await client.saveMessageToMemory({
      messages: [
        {
          role,
          content,
          id: crypto.randomUUID(),
          threadId,
          createdAt: new Date(),
          type: 'text',
        }
      ]
    })

    return savedMessages[0]
  } catch (error) {
    throw new MastraAPIError('Failed to add message', error)
  }
}

/**
 * Mastra API operations for thread management
 * Uses official Mastra Client SDK methods
 */
export const MastraAPI = {
  /**
   * Update thread properties (title, metadata)
   * Uses official SDK getMemoryThread and update methods
   */
  updateThread: async (id: string, updates: { title?: string; metadata?: Record<string, unknown> }, authToken?: string): Promise<MastraThread> => {
    try {
      const client = createMastraClient(authToken)
      const memoryThread = client.getMemoryThread(id, 'dynamicPersonaAgent')
      const updatedThread = await memoryThread.update(updates)
      return updatedThread
    } catch (error) {
      throw new MastraAPIError('Failed to update thread', error)
    }
  },

  /**
   * Delete a thread and all its messages
   * Uses official SDK getMemoryThread and delete methods
   */
  deleteThread: async (id: string, authToken?: string): Promise<void> => {
    try {
      const client = createMastraClient(authToken)
      const memoryThread = client.getMemoryThread(id, 'dynamicPersonaAgent')
      await memoryThread.delete()
    } catch (error) {
      throw new MastraAPIError('Failed to delete thread', error)
    }
  },

  /**
   * Get a single thread by ID
   * Uses official SDK getMemoryThread and get methods
   */
  getThread: async (id: string, authToken?: string): Promise<MastraThread> => {
    try {
      const client = createMastraClient(authToken)
      const memoryThread = client.getMemoryThread(id, 'dynamicPersonaAgent')
      const thread = await memoryThread.get()
      return thread
    } catch (error) {
      throw new MastraAPIError('Failed to get thread', error)
    }
  },
}

// Export the mastra client for direct access if needed
export { mastraClient }