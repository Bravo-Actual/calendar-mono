"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { get, set, del, createStore } from "idb-keyval";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { startRealtime, clearUserData } from "@/lib/realtime/subscriptions";

// Build an AsyncStorage-like wrapper over idb-keyval
const makeIdbStorage = (dbName: string, storeName: string) => {
  const store = createStore(dbName, storeName);
  return {
    getItem: (key: string) => get<string>(key, store),
    setItem: (key: string, value: string) => set(key, value, store),
    removeItem: (key: string) => del(key, store),
  };
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // One QueryClient instance
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, err: any) => (err?.status === 401 ? false : failureCount < 3),
      },
      mutations: {
        retry: (failureCount, err: any) => (err?.status === 401 ? false : failureCount < 2),
      },
    },
  }));

  // Build a user-scoped persister (prevents cross-account cache bleed)
  const persister = useMemo(() => {
    const userSuffix = user?.id ?? "anon";
    const idbAvailable = typeof indexedDB !== "undefined";
    const isClient = typeof window !== "undefined";

    if (idbAvailable && isClient) {
      const storage = makeIdbStorage("rq-cache", "rq"); // single connection, reused
      return createAsyncStoragePersister({
        storage,
        key: `tanstack-query:${userSuffix}`, // per-user namespace
      });
    }

    // Fallback to sync storage if IDB is unavailable (only on client)
    if (isClient) {
      return createSyncStoragePersister({
        storage: window.sessionStorage,
        key: `tanstack-query:${userSuffix}`,
      });
    }

    // Server-side: return undefined (no persistence)
    return undefined;
  }, [user?.id]);

  // Realtime subscriptions by auth state
  useEffect(() => {
    if (!user?.id) return;
    const stop = startRealtime(user.id, queryClient);
    return stop;
  }, [user?.id, queryClient]);

  // Clear data on logout (Dexie + persisted cache)
  useEffect(() => {
    if (!user) {
      const prev = localStorage.getItem("previousUserId");
      if (prev) {
        clearUserData(prev); // Dexie cleanup
        // Clear persisted query cache - the persister will handle this on next init
        localStorage.removeItem("previousUserId");
      }
    } else {
      localStorage.setItem("previousUserId", user.id);
    }
  }, [user]);

  // Request persistent storage durability
  useEffect(() => {
    navigator.storage?.persist?.();
  }, []);

  return (
    <>
      {persister ? (
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 24 * 60 * 60 * 1000,
            buster: "app-v1", // bump when breaking cache shape
          }}
        >
          <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />
          </QueryClientProvider>
        </PersistQueryClientProvider>
      ) : (
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />
        </QueryClientProvider>
      )}
    </>
  );
}