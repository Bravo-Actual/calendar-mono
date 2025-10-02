/**
 * Calendar AI API Client
 *
 * Client for the Express-based calendar-ai service with LangGraph + Supabase
 */

import type { UIMessage } from 'ai';

const CALENDAR_AI_URL = process.env.NEXT_PUBLIC_AGENT_URL!;

// Thread types matching Supabase ai_threads schema
export interface Thread {
  thread_id: string;
  user_id: string;
  persona_id?: string;
  title?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Message types matching Supabase ai_messages schema
export interface Message {
  message_id: string;
  thread_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: {
    parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
  };
  metadata?: Record<string, unknown>;
  created_at: string;
}

class CalendarAIError extends Error {
  constructor(
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'CalendarAIError';
  }
}

/**
 * Get threads for a user, optionally filtered by persona
 */
export async function getThreads(
  userId: string,
  personaId?: string,
  authToken?: string
): Promise<Thread[]> {
  if (!authToken) {
    console.warn('getThreads called without auth token - returning empty array');
    return [];
  }

  try {
    const url = new URL(`${CALENDAR_AI_URL}/api/threads`);
    if (personaId) {
      url.searchParams.set('personaId', personaId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch threads: ${response.status}`);
    }

    const data = await response.json();
    return data.threads || [];
  } catch (error) {
    throw new CalendarAIError('Failed to get threads', error);
  }
}

/**
 * Get a specific thread by ID
 */
export async function getThread(threadId: string, authToken?: string): Promise<Thread | null> {
  if (!authToken) {
    return null;
  }

  try {
    const response = await fetch(`${CALENDAR_AI_URL}/api/threads/${threadId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch thread: ${response.status}`);
    }

    const data = await response.json();
    return data.thread;
  } catch (error) {
    throw new CalendarAIError('Failed to get thread', error);
  }
}

/**
 * Create a new thread
 */
export async function createThread(
  data: {
    threadId?: string;
    userId: string;
    personaId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
  },
  authToken?: string
): Promise<Thread> {
  if (!authToken) {
    throw new CalendarAIError('Auth token required to create thread');
  }

  try {
    const response = await fetch(`${CALENDAR_AI_URL}/api/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create thread: ${response.status}`);
    }

    const result = await response.json();
    return result.thread;
  } catch (error) {
    throw new CalendarAIError('Failed to create thread', error);
  }
}

/**
 * Update a thread
 */
export async function updateThread(
  threadId: string,
  updates: { title?: string; metadata?: Record<string, unknown> },
  authToken?: string
): Promise<Thread> {
  if (!authToken) {
    throw new CalendarAIError('Auth token required to update thread');
  }

  try {
    const response = await fetch(`${CALENDAR_AI_URL}/api/threads/${threadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update thread: ${response.status}`);
    }

    const data = await response.json();
    return data.thread;
  } catch (error) {
    throw new CalendarAIError('Failed to update thread', error);
  }
}

/**
 * Delete a thread
 */
export async function deleteThread(threadId: string, authToken?: string): Promise<void> {
  if (!authToken) {
    throw new CalendarAIError('Auth token required to delete thread');
  }

  try {
    const response = await fetch(`${CALENDAR_AI_URL}/api/threads/${threadId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete thread: ${response.status}`);
    }
  } catch (error) {
    throw new CalendarAIError('Failed to delete thread', error);
  }
}

/**
 * Get messages for a thread, formatted for AI SDK UIMessage compatibility
 */
export async function getMessages(
  threadId: string,
  limit: number = 50,
  authToken?: string
): Promise<UIMessage[]> {
  if (!authToken) {
    console.warn('getMessages called without auth token - returning empty array');
    return [];
  }

  try {
    const url = new URL(`${CALENDAR_AI_URL}/api/threads/${threadId}/messages`);
    url.searchParams.set('limit', limit.toString());

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }

    const data = await response.json();
    const messages: Message[] = data.messages || [];

    // Convert to UIMessage format
    return messages.map((msg) => ({
      id: msg.message_id,
      role: msg.role,
      parts: msg.content?.parts || [],
      metadata: {
        createdAt: msg.created_at,
        threadId: msg.thread_id,
        userId: msg.user_id,
        ...msg.metadata,
      },
    }));
  } catch (error) {
    throw new CalendarAIError('Failed to get messages', error);
  }
}

/**
 * Stream chat endpoint URL for AI SDK useChat
 */
export function getStreamChatURL(): string {
  return `${CALENDAR_AI_URL}/api/chat/stream`;
}

/**
 * Non-streaming chat endpoint for direct message generation
 */
export async function generateMessage(
  message: string,
  threadId: string,
  personaId?: string,
  authToken?: string
): Promise<{ message: string; threadId: string }> {
  if (!authToken) {
    throw new CalendarAIError('Auth token required to generate message');
  }

  try {
    const response = await fetch(`${CALENDAR_AI_URL}/api/chat/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ message, threadId, personaId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate message: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new CalendarAIError('Failed to generate message', error);
  }
}
