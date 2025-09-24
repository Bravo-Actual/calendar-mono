"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, makePersister, initializeStoragePersistence } from "@/lib/data/base/persist";
import { startRealtime, clearUserData } from "@/lib/realtime/subscriptions";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Create persister synchronously now
  const persister = makePersister(user?.id);

  // Initialize storage persistence on mount
  useEffect(() => {
    initializeStoragePersistence();
  }, []);

  // Realtime subscriptions by auth state
  useEffect(() => {
    if (!user?.id) return;
    console.log('🔄 Starting realtime subscriptions for user:', user.id);
    const stop = startRealtime(user.id, queryClient);
    return () => {
      console.log('🔄 Cleaning up realtime subscriptions');
      stop();
    };
  }, [user?.id]);

  // Clear data on logout (Dexie + persisted cache)
  useEffect(() => {
    if (!user) {
      const prev = localStorage.getItem("previousUserId");
      if (prev) {
        clearUserData(prev); // Dexie cleanup
        localStorage.removeItem("previousUserId");
      }
      // Clear query cache on logout
      queryClient.clear();
      console.log('👤 User logged out, cache cleared');
    } else {
      localStorage.setItem("previousUserId", user.id);
      console.log('👤 User logged in, cache will be restored');
    }
  }, [user]);

  return (
    <>
      {persister ? (
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 24 * 60 * 60 * 1000,
            buster: "app-v3", // bump when breaking cache shape (updated for new architecture)
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