import { generateUUID } from '../base/utils';
import { db } from './dexie';
import { pushOutbox } from './sync';

// Track pending pushOutbox operations per user to prevent duplicate simultaneous syncs
const pendingPushes = new Map<string, Promise<void>>();

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
  recordId?: string,
  pkColumn?: string // Optional: primary key column name (defaults to 'id')
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

  let shouldTriggerPush = false;

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
    // Add the delete operation (for existing items)
    await db.outbox.add({
      id: generateUUID(),
      user_id: userId,
      table,
      op: operation,
      payload,
      pk_column: pkColumn,
      created_at: now.toISOString(),
      attempts: 0,
    });
    console.log(`✨ [OUTBOX] Created new ${table} ${operation} item`);
    shouldTriggerPush = true;
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

      // Don't trigger a new push - the existing INSERT operation will be processed
      // by the already-pending pushOutbox call
      console.log('⏭️ [OUTBOX] Skipping push trigger - UPDATE merged into pending INSERT');
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

      // Don't trigger a new push - let the existing operation complete first
      console.log('⏭️ [OUTBOX] Skipping push trigger - UPDATE merged into existing UPDATE');
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
  } else {
    // No existing item found, or operation doesn't require merging - create new
    // This handles: new inserts, new updates
    await db.outbox.add({
      id: generateUUID(),
      user_id: userId,
      table,
      op: operation,
      payload,
      pk_column: pkColumn, // Store primary key column if provided
      created_at: now.toISOString(),
      attempts: 0,
    });

    console.log(`✨ [OUTBOX] Created new ${table} ${operation} item`);
    shouldTriggerPush = true;
  }

  // Trigger immediate sync if online and we actually added a new operation
  if (shouldTriggerPush && navigator.onLine) {
    // Check if there's already a pending push for this user
    const existingPush = pendingPushes.get(userId);

    if (existingPush) {
      console.log(`⏭️ [OUTBOX] Push already in progress for user ${userId}, waiting...`);
      // Wait for existing push to complete, then trigger a new one
      await existingPush;
    }

    // Create and track the new push operation
    const pushPromise = pushOutbox(userId)
      .catch((error) => {
        console.error('Failed to process outbox after adding item:', error);
      })
      .finally(() => {
        // Clean up tracking when done
        if (pendingPushes.get(userId) === pushPromise) {
          pendingPushes.delete(userId);
        }
      });

    pendingPushes.set(userId, pushPromise);
  }
}
