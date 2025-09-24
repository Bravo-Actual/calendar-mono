/**
 * TanStack Query Persistence with IndexedDB
 * Per-user cache persistence that survives page reloads
 */

import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Check if IndexedDB is available (safer than typeof check)
function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && !!indexedDB;
  } catch {
    return false;
  }
}

/**
 * Create IndexedDB-backed storage for query persistence
 */
async function createIndexedDBStorage() {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB not available');
  }

  // Simple IndexedDB wrapper
  const dbName = 'tanstack-query-cache';
  const storeName = 'cache';
  const version = 1;

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
    });
  };

  const storage = {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const db = await openDB();
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
          const request = store.get(key);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result || null);
        });
      } catch (error) {
        console.warn('Failed to get from IndexedDB:', error);
        return null;
      }
    },

    setItem: async (key: string, value: string): Promise<void> => {
      try {
        const db = await openDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
          const request = store.put(value, key);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      } catch (error) {
        console.warn('Failed to set in IndexedDB:', error);
      }
    },

    removeItem: async (key: string): Promise<void> => {
      try {
        const db = await openDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
          const request = store.delete(key);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      } catch (error) {
        console.warn('Failed to remove from IndexedDB:', error);
      }
    },
  };

  return storage;
}

/**
 * Create fallback sessionStorage for environments where IndexedDB fails
 */
function createFallbackStorage() {
  return {
    getItem: (key: string) => Promise.resolve(sessionStorage.getItem(key)),
    setItem: (key: string, value: string) => Promise.resolve(sessionStorage.setItem(key, value)),
    removeItem: (key: string) => Promise.resolve(sessionStorage.removeItem(key)),
  };
}

/**
 * Create persister with per-user namespacing
 */
export function makePersister(userId: string | undefined) {
  const uid = userId ?? 'anon';

  // Use sessionStorage with user prefix for now (simpler and more reliable)
  const storage = {
    getItem: (key: string) => sessionStorage.getItem(`tanstack:${uid}:${key}`),
    setItem: (key: string, value: string) => sessionStorage.setItem(`tanstack:${uid}:${key}`, value),
    removeItem: (key: string) => sessionStorage.removeItem(`tanstack:${uid}:${key}`),
  };

  return createSyncStoragePersister({
    storage,
    throttleTime: 1000,
  });
}

/**
 * Default QueryClient configuration optimized for offline-first
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      gcTime: 30 * 60_000, // 30 minutes
      refetchOnWindowFocus: true, // Sync when user returns
      refetchOnReconnect: true, // Sync when network returns
      retry: (failureCount, error: any) => {
        // Don't retry auth errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry auth errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        // Retry up to 2 times for mutations
        return failureCount < 2;
      },
    },
  },
});

/**
 * Initialize storage persistence
 * Call this once when the app starts
 */
export async function initializeStoragePersistence() {
  try {
    // Request persistent storage if available
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const isPersistent = await navigator.storage.persist();
      console.log('Persistent storage granted:', isPersistent);
    }
  } catch (error) {
    console.warn('Failed to request persistent storage:', error);
  }
}