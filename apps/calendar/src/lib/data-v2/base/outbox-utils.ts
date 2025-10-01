import { generateUUID } from '../base/utils';
import { db } from './dexie';

/**
 * Add an item to the outbox with deduplication/merging.
 * Logic:
 * - New item: Merge subsequent updates into insert
 * - Updated items: Merge subsequent updates into single update
 * - Deleting existing items: Remove updates and keep delete item
 * - Deleting new items: Remove insert and updates, don't add delete (item never existed)
 */
export async function addToOutboxWithMerging(
  userId: string,
  table: string,
  operation: 'insert' | 'update' | 'delete',
  payload: any,
  recordId?: string
): Promise<void> {
  const now = new Date();

  // Find any existing operations for this record
  const existingItems = recordId
    ? await db.outbox
        .where('user_id')
        .equals(userId)
        .and((item) => item.table === table && item.payload?.id === recordId)
        .toArray()
    : [];

  if (operation === 'delete' && recordId) {
    if (existingItems.length > 0) {
      const hasInsert = existingItems.some((item) => item.op === 'insert');

      if (hasInsert) {
        // Deleting new items: Remove insert and updates, don't add delete (item never existed)
        const itemIds = existingItems.map((item) => item.id);
        await db.outbox.bulkDelete(itemIds);
        console.log(
          `🗑️ [OUTBOX] Removed ${existingItems.length} operations for new item ${table}:`,
          recordId,
          '(item never existed on server)'
        );
        return; // Don't add the delete operation
      } else {
        // Deleting existing items: Remove updates and keep delete item
        const itemIds = existingItems.map((item) => item.id);
        await db.outbox.bulkDelete(itemIds);
        console.log(
          `🗑️ [OUTBOX] Removed ${existingItems.length} existing operations for ${table} before DELETE:`,
          recordId
        );
      }
    }
    // Add the delete operation (for existing items) or do nothing (for new items handled above)
  } else if (operation === 'update' && recordId && existingItems.length > 0) {
    const existingItem = existingItems[0];

    if (existingItem.op === 'insert') {
      // New item: Merge subsequent updates into insert
      // Be careful with undefined values in UPDATE payloads - only merge defined fields
      const mergedPayload = { ...existingItem.payload };

      // Only merge fields that are actually defined in the update payload
      Object.keys(payload).forEach((key) => {
        if (payload[key] !== undefined) {
          mergedPayload[key] = payload[key];
        }
      });

      console.log(`🔄 [OUTBOX] Merging ${table} UPDATE into existing INSERT for record:`, recordId);
      console.log('🔍 [OUTBOX] Original INSERT payload keys:', Object.keys(existingItem.payload));
      console.log('🔍 [OUTBOX] UPDATE payload keys:', Object.keys(payload));
      console.log('🔍 [OUTBOX] Merged payload keys:', Object.keys(mergedPayload));

      await db.outbox.update(existingItem.id, {
        payload: mergedPayload,
        created_at: now.toISOString(),
        attempts: 0,
      });
    } else if (existingItem.op === 'update') {
      // Updated items: Merge subsequent updates into single update
      const mergedPayload = {
        ...existingItem.payload,
        ...payload, // Last write wins
      };

      console.log(`🔄 [OUTBOX] Merging ${table} UPDATE into existing UPDATE for record:`, recordId);

      await db.outbox.update(existingItem.id, {
        payload: mergedPayload,
        created_at: now.toISOString(),
        attempts: 0,
      });
    }

    // Remove any additional duplicate items
    if (existingItems.length > 1) {
      const duplicateIds = existingItems.slice(1).map((item) => item.id);
      await db.outbox.bulkDelete(duplicateIds);
      console.log(
        `🧹 [OUTBOX] Removed ${duplicateIds.length} duplicate items for ${table}:`,
        recordId
      );
    }

    return;
  }

  // No existing item found, or operation doesn't require merging - create new
  // This handles: new inserts, new updates, and delete operations for existing items
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
