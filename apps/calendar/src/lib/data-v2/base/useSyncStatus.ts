// data-v2/base/useSyncStatus.ts - Sync status hook for UI badges
'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './dexie';

export interface SyncStatus {
  online: boolean;
  outboxCount: number;
  syncing: boolean;
  lastSync?: string;
  hasErrors: boolean;
}

export function useSyncStatus(userId?: string): SyncStatus {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  // Count pending outbox items
  const outboxCount = useLiveQuery(async () => {
    if (!userId) return 0;
    return await db.outbox.where('user_id').equals(userId).count();
  }, [userId], 0);

  // Count failed outbox items (with errors)
  const errorCount = useLiveQuery(async () => {
    if (!userId) return 0;
    return await db.outbox
      .where('user_id')
      .equals(userId)
      .filter(item => !!item._error)
      .count();
  }, [userId], 0);

  // Get last sync timestamp
  const lastSync = useLiveQuery(async () => {
    if (!userId) return undefined;

    // Get the most recent watermark across all tables
    const watermarks = await db.meta
      .where('key')
      .startsWith(`last_sync:`)
      .and(item => item.key.endsWith(`:${userId}`))
      .toArray();

    if (watermarks.length === 0) return undefined;

    // Return the most recent watermark
    const latest = watermarks.reduce((latest, current) => {
      return new Date(current.value) > new Date(latest.value) ? current : latest;
    });

    return latest.value;
  }, [userId]);

  // Set up online/offline listeners
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    online,
    outboxCount: outboxCount || 0,
    syncing: online && (outboxCount || 0) > 0,
    lastSync,
    hasErrors: (errorCount || 0) > 0,
  };
}