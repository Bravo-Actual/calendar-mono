// data-v2/domains/ai-threads.ts - Offline-first ai threads implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientThread } from '../base/client-types';
import { db } from '../base/dexie';
import { mapThreadFromServer } from '../base/mapping';
import { addToOutboxWithMerging } from '../base/outbox-utils';
import { pullTable } from '../base/sync';

// Read hooks using useLiveQuery (instant, reactive)
export function useAIThreads(uid: string | undefined, personaId?: string | undefined) {
  return useLiveQuery(async (): Promise<ClientThread[]> => {
    if (!uid) return [];

    const query = db.ai_threads.where('user_id').equals(uid);

    if (personaId) {
      // Filter by persona_id if specified
      const threads = await query.toArray();
      return threads
        .filter((t) => t.persona_id === personaId)
        .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
    }

    return await query.sortBy('updated_at').then((threads) => threads.reverse());
  }, [uid, personaId]);
}

export function useAIThread(uid: string | undefined, threadId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientThread | undefined> => {
    if (!uid || !threadId) return undefined;

    const thread = await db.ai_threads.get(threadId);
    return thread?.user_id === uid ? thread : undefined;
  }, [uid, threadId]);
}

// Delete function (no create/update since threads are managed by Mastra on the backend)
export async function deleteAIThread(uid: string, threadId: string): Promise<void> {
  // 1. Get existing thread from Dexie
  const existing = await db.ai_threads.get(threadId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('AI thread not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.ai_threads.delete(threadId);

  // 3. Enqueue in outbox for eventual server sync
  await addToOutboxWithMerging(
    uid,
    'ai_threads',
    'delete',
    { thread_id: threadId },
    threadId,
    'thread_id' // Specify the primary key column
  );
}

// Data sync functions (called by DataProvider)
export async function pullAIThreads(uid: string): Promise<void> {
  return pullTable('ai_threads', uid, mapThreadFromServer);
}
