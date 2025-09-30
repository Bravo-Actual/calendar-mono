// data-v2/domains/categories.ts - Categories offline-first implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientCategory } from '../base/client-types';
import { db } from '../base/dexie';
import { mapCategoryFromServer, mapCategoryToServer } from '../base/mapping';
import { pullTable } from '../base/sync';
import { generateUUID, nowISO } from '../base/utils';
import { CategorySchema, validateBeforeEnqueue } from '../base/validators';

// Read hooks using useLiveQuery (instant, reactive)
export function useUserCategories(uid: string | undefined): ClientCategory[] {
  return useLiveQuery(
    async () => {
      if (!uid) return [];

      return await db.user_categories.where('user_id').equals(uid).sortBy('name');
    },
    [uid],
    [] // Default value prevents undefined
  ) as ClientCategory[];
}

export function useUserCategory(uid: string | undefined, categoryId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientCategory | undefined> => {
    if (!uid || !categoryId) return undefined;

    const category = await db.user_categories.get(categoryId);
    return category?.user_id === uid ? category : undefined;
  }, [uid, categoryId]);
}

// Dexie-first mutations with outbox pattern
export async function createCategory(
  uid: string,
  input: {
    name: string;
    color?: ClientCategory['color'];
    is_default?: boolean;
  }
): Promise<ClientCategory> {
  const id = generateUUID();
  const now = new Date();

  const category: ClientCategory = {
    id,
    user_id: uid,
    name: input.name,
    color: input.color ?? 'neutral',
    is_default: input.is_default ?? false,
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedCategory = validateBeforeEnqueue(CategorySchema, category);

  // 2. Write to Dexie first (instant optimistic update)
  await db.user_categories.put(validatedCategory);

  // 3. Enqueue in outbox for eventual server sync (convert Date objects to ISO strings)
  const serverPayload = mapCategoryToServer(validatedCategory);
  const outboxId = generateUUID();
  await db.outbox.add({
    id: outboxId,
    user_id: uid,
    table: 'user_categories',
    op: 'insert',
    payload: serverPayload,
    created_at: now.toISOString(),
    attempts: 0,
  });

  return category;
}

export async function updateCategory(
  uid: string,
  categoryId: string,
  input: {
    name?: string;
    color?: ClientCategory['color'];
    is_default?: boolean;
  }
): Promise<void> {
  // 1. Get existing category from Dexie
  const existing = await db.user_categories.get(categoryId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Category not found or access denied');
  }

  const now = new Date();
  const updated: ClientCategory = {
    ...existing,
    ...input,
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedCategory = validateBeforeEnqueue(CategorySchema, updated);

  // 3. Update in Dexie first (instant optimistic update)
  await db.user_categories.put(validatedCategory);

  // 4. Enqueue in outbox for eventual server sync (convert Date objects to ISO strings)
  const serverPayload = mapCategoryToServer(validatedCategory);
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'user_categories',
    op: 'update',
    payload: serverPayload,
    created_at: now.toISOString(),
    attempts: 0,
  });
}

export async function deleteCategory(uid: string, categoryId: string): Promise<void> {
  // 1. Get existing category from Dexie
  const existing = await db.user_categories.get(categoryId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('Category not found or access denied');
  }

  // Prevent deletion of default category (business logic)
  if (existing.is_default) {
    throw new Error('Cannot delete default category');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.user_categories.delete(categoryId);

  // 3. Enqueue in outbox for eventual server sync
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'user_categories',
    op: 'delete',
    payload: { id: categoryId },
    created_at: nowISO(),
    attempts: 0,
  });
}

// Sync functions using the centralized infrastructure
export async function pullCategories(userId: string): Promise<void> {
  return pullTable('user_categories', userId, mapCategoryFromServer);
}
