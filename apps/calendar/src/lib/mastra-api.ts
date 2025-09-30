/**
 * Mastra Memory API Client for Calendar App
 *
 * Uses the official Mastra Client SDK for conversation and message management.
 * Provides a clean interface that wraps Mastra SDK methods with proper types.
 */

import { MastraClient } from '@mastra/client-js';
import type { UIMessage } from 'ai';
import { requireSession, AuthError } from './auth-guards';

// Simplified thread type based on what Mastra actually returns
export interface MastraThread {
  id: string;
  title?: string | null;
  resourceId: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  agentId?: string;
}

export interface ThreadWithLatestMessage extends MastraThread {
  latest_message?: {
    content: unknown;
    role: string;
    createdAt: string;
  };
}

// Create MastraClient with JWT authentication (following official Mastra pattern)
const createMastraClient = (authToken?: string) => {
  return new MastraClient({
    baseUrl: process.env.NEXT_PUBLIC_AGENT_URL!,
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : undefined,
  });
};

// Default client instance (will be replaced with authenticated calls)
const mastraClient = createMastraClient();

class MastraAPIError extends Error {
  constructor(
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'MastraAPIError';
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
    const client = createMastraClient(authToken);
    const thread = await client.createMemoryThread({
      resourceId,
      agentId: 'dynamicPersonaAgent', // The agent key registered in mastra/index.ts
      title,
      metadata,
    });
    return {
      ...thread,
      createdAt:
        thread.createdAt instanceof Date ? thread.createdAt.toISOString() : thread.createdAt,
      updatedAt:
        thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : thread.updatedAt,
    } as MastraThread;
  } catch (error) {
    throw new MastraAPIError('Failed to create thread', error);
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
  // Auth guard - this function should never be called without a valid session
  try {
    if (!authToken) {
      const session = await requireSession();
      authToken = session.access_token;
    }
  } catch (error) {
    // If auth error (signed out), return empty array immediately
    if (error instanceof AuthError) {
      return [];
    }
    throw error;
  }

  try {
    const client = createMastraClient(authToken);
    // Get threads using official SDK - requires both resourceId and agentId
    const threads = await client.getMemoryThreads({
      resourceId,
      agentId: 'dynamicPersonaAgent', // The agent key registered in mastra/index.ts
      // NOTE: Mastra API doesn't support orderBy/sortDirection parameters
      // Using client-side sorting instead (see bottom of function)
      // orderBy: 'updatedAt',
      // sortDirection: 'DESC'
    });

    // Filter by persona if specified
    const filteredThreads = personaId
      ? threads.filter((thread) => {
          try {
            // Handle both string and object metadata formats
            const metadata =
              typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata;
            return metadata?.personaId === personaId;
          } catch (_error) {
            return false;
          }
        })
      : threads;

    // Get latest message for each thread using the memory thread instance
    const threadsWithMessages = await Promise.all(
      filteredThreads.map(async (thread) => {
        try {
          const memoryThread = client.getMemoryThread(thread.id, 'dynamicPersonaAgent');
          const { messages } = await memoryThread.getMessages({ limit: 1 });

          const latestMessage = messages[0];

          return {
            ...thread,
            createdAt:
              thread.createdAt instanceof Date ? thread.createdAt.toISOString() : thread.createdAt,
            updatedAt:
              thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : thread.updatedAt,
            latest_message: latestMessage
              ? {
                  content: latestMessage.content,
                  role: latestMessage.role,
                  // Mastra messages have createdAt as Date, but TypeScript types are incomplete
                  createdAt:
                    (latestMessage as any).createdAt instanceof Date
                      ? (latestMessage as any).createdAt.toISOString()
                      : (latestMessage as any).createdAt || thread.updatedAt || thread.createdAt,
                }
              : undefined,
          } as ThreadWithLatestMessage;
        } catch (_error) {
          return {
            ...thread,
            createdAt:
              thread.createdAt instanceof Date ? thread.createdAt.toISOString() : thread.createdAt,
            updatedAt:
              thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : thread.updatedAt,
            latest_message: undefined,
          } as ThreadWithLatestMessage;
        }
      })
    );

    // Sort threads client-side by most recently updated first (since API sorting not available)
    const sortedThreads = threadsWithMessages.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      return bTime - aTime; // Descending order (most recent first)
    });

    return sortedThreads;
  } catch (error) {
    // If auth error (signed out), return empty array instead of throwing
    if (error instanceof AuthError) {
      return [];
    }
    throw new MastraAPIError('Failed to get threads', error);
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
  // Auth guard - this function should never be called without a valid session
  try {
    if (!authToken) {
      const session = await requireSession();
      authToken = session.access_token;
    }
  } catch (error) {
    // If auth error (signed out), return empty array immediately
    if (error instanceof AuthError) {
      return [];
    }
    throw error;
  }

  try {
    // Use the new paginated API endpoint with v2 format
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_AGENT_URL}/api/memory/threads/${threadId}/messages/paginated?format=v2&limit=${limit}`,
      {
        headers: authToken
          ? {
              Authorization: `Bearer ${authToken}`,
            }
          : {},
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }

    const data = await response.json();
    const rawMessages = data.messages || [];

    // Convert Mastra v2 format to UIMessage format
    const messages: UIMessage[] = rawMessages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      parts: msg.content?.parts || [],
      metadata: {
        createdAt: msg.createdAt,
        threadId: msg.threadId,
        resourceId: msg.resourceId,
      },
    }));

    // Sort messages chronologically (oldest first) and return
    return messages.sort((a, b) => {
      const aTime = new Date((a.metadata as any)?.createdAt || 0).getTime();
      const bTime = new Date((b.metadata as any)?.createdAt || 0).getTime();
      return aTime - bTime; // Ascending order (oldest first)
    });
  } catch (error) {
    // If auth error (signed out), return empty array instead of throwing
    if (error instanceof AuthError) {
      return [];
    }
    throw new MastraAPIError('Failed to get messages', error);
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
    const client = createMastraClient(authToken);
    const savedMessages = await client.saveMessageToMemory({
      messages: [
        {
          role,
          content,
          id: `message-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          threadId,
          createdAt: new Date(),
          type: 'text',
        },
      ],
      agentId: 'dynamicPersonaAgent',
    });

    return savedMessages[0];
  } catch (error) {
    throw new MastraAPIError('Failed to add message', error);
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
  updateThread: async (
    id: string,
    updates: { title?: string; metadata?: Record<string, unknown> },
    authToken?: string
  ): Promise<MastraThread> => {
    try {
      const client = createMastraClient(authToken);
      const memoryThread = client.getMemoryThread(id, 'dynamicPersonaAgent');
      const updatedThread = await memoryThread.update({
        title: updates.title || '',
        metadata: updates.metadata || {},
        resourceId: (updates.metadata?.resourceId as string) || 'unknown',
      });
      return {
        ...updatedThread,
        createdAt:
          updatedThread.createdAt instanceof Date
            ? updatedThread.createdAt.toISOString()
            : updatedThread.createdAt,
        updatedAt:
          updatedThread.updatedAt instanceof Date
            ? updatedThread.updatedAt.toISOString()
            : updatedThread.updatedAt,
      } as MastraThread;
    } catch (error) {
      throw new MastraAPIError('Failed to update thread', error);
    }
  },

  /**
   * Delete a thread and all its messages
   * Uses official SDK getMemoryThread and delete methods
   */
  deleteThread: async (id: string, authToken?: string): Promise<void> => {
    try {
      const client = createMastraClient(authToken);
      const memoryThread = client.getMemoryThread(id, 'dynamicPersonaAgent');
      await memoryThread.delete();
    } catch (error) {
      throw new MastraAPIError('Failed to delete thread', error);
    }
  },

  /**
   * Get a single thread by ID
   * Uses official SDK getMemoryThread and get methods
   */
  getThread: async (id: string, authToken?: string): Promise<MastraThread> => {
    try {
      const client = createMastraClient(authToken);
      const memoryThread = client.getMemoryThread(id, 'dynamicPersonaAgent');
      const thread = await memoryThread.get();
      return {
        ...thread,
        createdAt:
          thread.createdAt instanceof Date ? thread.createdAt.toISOString() : thread.createdAt,
        updatedAt:
          thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : thread.updatedAt,
      } as MastraThread;
    } catch (error) {
      throw new MastraAPIError('Failed to get thread', error);
    }
  },
};

// Export the mastra client for direct access if needed
export { mastraClient };
