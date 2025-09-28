import { db } from './dexie';
import { generateUUID } from '../../data/base/utils';

/**
 * Add an item to the outbox with deduplication/merging.
 * If an existing outbox item exists for the same record, merge the payloads
 * with last-write-wins semantics at the field level.
 */
export async function addToOutboxWithMerging(
  userId: string,
  table: string,
  operation: 'insert' | 'update' | 'delete',
  payload: any,
  recordId?: string
): Promise<void> {
  const now = new Date();

  // For update operations, check for existing outbox items to merge
  // This includes both UPDATE operations and INSERT operations for the same record
  if (operation === 'update' && recordId) {
    const existingItems = await db.outbox
      .where('user_id')
      .equals(userId)
      .and(item => item.table === table && item.payload?.id === recordId)
      .toArray();

    if (existingItems.length > 0) {
      // Merge with existing item - last write wins at field level
      const existingItem = existingItems[0];
      const mergedPayload = {
        ...existingItem.payload,
        ...payload, // Last write wins
      };

      console.log(`🔄 [OUTBOX] Merging ${table} ${operation} into existing ${existingItem.op} for record:`, recordId);

      // Update existing item - keep the original operation type (INSERT stays INSERT)
      await db.outbox.update(existingItem.id, {
        payload: mergedPayload,
        created_at: now.toISOString(), // Update timestamp
        attempts: 0, // Reset attempts for merged item
      });

      // Remove any additional duplicate items
      if (existingItems.length > 1) {
        const duplicateIds = existingItems.slice(1).map(item => item.id);
        await db.outbox.bulkDelete(duplicateIds);
        console.log(`🧹 [OUTBOX] Removed ${duplicateIds.length} duplicate items for ${table}:`, recordId);
      }

      return;
    }
  }

  // No existing item found, or not an update operation - create new
  await db.outbox.add({
    id: generateUUID(),
    user_id: userId,
    table,
    op: operation,
    payload,
    created_at: now.toISOString(),
    attempts: 0,
  });

  console.log(`✨ [OUTBOX] Created new ${table} ${operation} item`);
}