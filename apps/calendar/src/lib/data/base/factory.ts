/**
 * Generic Hook Factory for Consistent CRUD Operations
 * Provides unified patterns for all data types with offline-first architecture
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryKey,
  UseMutationOptions,
  UseQueryOptions
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { db } from './dexie';
import { keys } from './keys';
import { generateId } from './utils';

// Generic types for CRUD operations
export interface CRUDConfig<TData, TInsert = Partial<TData>, TUpdate = Partial<TData>> {
  tableName: string;
  dexieTable: any; // Dexie table reference
  getQueryKey: (params?: any) => QueryKey;
  userId?: string;
  userIdField?: string; // Field name for user_id in the table
}

/**
 * Generic query hook factory
 */
export function createQueryHook<TData, TParams = void>(
  config: CRUDConfig<TData> & {
    select?: string;
    filters?: (params: TParams) => Record<string, any>;
    orderBy?: { column: string; ascending?: boolean }[];
  }
) {
  return function useGenericQuery(
    params?: TParams,
    options?: Omit<UseQueryOptions<TData[]>, 'queryKey' | 'queryFn'>
  ) {
    return useQuery({
      queryKey: config.getQueryKey(params),
      queryFn: async (): Promise<TData[]> => {
        let query = supabase
          .from(config.tableName)
          .select(config.select || '*');

        // Apply user filter if configured
        if (config.userId && config.userIdField) {
          query = query.eq(config.userIdField, config.userId);
        }

        // Apply additional filters
        if (config.filters && params) {
          const filters = config.filters(params);
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined) {
              query = query.eq(key, value);
            }
          });
        }

        // Apply ordering
        if (config.orderBy) {
          config.orderBy.forEach(({ column, ascending = true }) => {
            query = query.order(column, { ascending });
          });
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
      },
      staleTime: 60_000, // 1 minute
      gcTime: 5 * 60_000, // 5 minutes
      ...options,
    });
  };
}

/**
 * Generic create mutation hook factory with optimistic updates
 */
export function createCreateHook<TData, TInsert = Partial<TData>>(
  config: CRUDConfig<TData, TInsert> & {
    select?: string;
    onSuccessMessage?: string;
    onErrorMessage?: string;
    invalidateQueries?: (data: TData) => QueryKey[];
    generateOptimisticId?: () => string;
  }
) {
  return function useGenericCreate(
    options?: UseMutationOptions<TData, Error, TInsert>
  ) {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (data: TInsert): Promise<TData> => {
        const insertData = { ...data };

        // Auto-add user_id if configured
        if (config.userId && config.userIdField) {
          (insertData as any)[config.userIdField] = config.userId;
        }

        // Generate optimistic ID for immediate cache updates
        const optimisticId = config.generateOptimisticId?.() || generateId();
        const optimisticData = {
          ...insertData,
          id: optimisticId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as TData;

        // 1. Optimistic Dexie write
        await config.dexieTable.put(optimisticData);

        // 2. Optimistic cache update using setQueriesData (surgical)
        queryClient.setQueriesData(
          { queryKey: config.getQueryKey() },
          (oldData: TData[] | undefined) => {
            if (!oldData) return [optimisticData];
            return [...oldData, optimisticData];
          }
        );

        try {
          // 3. Server insert
          const { data: result, error } = await supabase
            .from(config.tableName)
            .insert(insertData)
            .select(config.select || '*')
            .single();

          if (error) throw error;
          if (!result) throw new Error('No data returned from insert');

          // 4. Replace optimistic data with real server data
          await config.dexieTable.put(result);
          await config.dexieTable.delete(optimisticId); // Remove optimistic entry if different ID

          // 5. Update cache with real server data
          queryClient.setQueriesData(
            { queryKey: config.getQueryKey() },
            (oldData: TData[] | undefined) => {
              if (!oldData) return [result];
              return oldData.map(item =>
                (item as any).id === optimisticId ? result : item
              );
            }
          );

          return result;

        } catch (error) {
          // Rollback optimistic updates on failure
          await config.dexieTable.delete(optimisticId);
          queryClient.setQueriesData(
            { queryKey: config.getQueryKey() },
            (oldData: TData[] | undefined) => {
              if (!oldData) return undefined;
              return oldData.filter(item => (item as any).id !== optimisticId);
            }
          );
          throw error;
        }
      },
      onSuccess: (data) => {
        if (config.onSuccessMessage) {
          toast.success(config.onSuccessMessage);
        }
        // Additional queries can still be invalidated
        const additionalQueries = config.invalidateQueries?.(data) || [];
        additionalQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });
      },
      onError: (error: Error) => {
        console.error(`Error creating ${config.tableName}:`, error);
        toast.error(config.onErrorMessage || `Failed to create ${config.tableName}`);
      },
      ...options,
    });
  };
}

/**
 * Generic update mutation hook factory with optimistic updates
 */
export function createUpdateHook<TData, TUpdate = Partial<TData>>(
  config: CRUDConfig<TData, any, TUpdate> & {
    select?: string;
    onSuccessMessage?: string;
    onErrorMessage?: string;
    invalidateQueries?: (data: TData) => QueryKey[];
  }
) {
  return function useGenericUpdate(
    options?: UseMutationOptions<TData, Error, { id: string } & TUpdate>
  ) {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ id, ...updateData }: { id: string } & TUpdate): Promise<TData> => {
        // 1. Get original data for rollback
        const originalData = await config.dexieTable.get(id);

        // 2. Create optimistic update
        const optimisticData = {
          ...originalData,
          ...updateData,
          updated_at: new Date().toISOString(),
        } as TData;

        // 3. Optimistic Dexie update
        await config.dexieTable.put(optimisticData);

        // 4. Optimistic cache update using setQueriesData (surgical)
        queryClient.setQueriesData(
          { queryKey: config.getQueryKey() },
          (oldData: TData[] | undefined) => {
            if (!oldData) return undefined;
            return oldData.map(item =>
              (item as any).id === id ? optimisticData : item
            );
          }
        );

        try {
          // 5. Server update
          let query = supabase
            .from(config.tableName)
            .update(updateData)
            .eq('id', id);

          // Add user restriction if configured
          if (config.userId && config.userIdField) {
            query = query.eq(config.userIdField, config.userId);
          }

          const { data: result, error } = await query
            .select(config.select || '*')
            .single();

          if (error) throw error;
          if (!result) throw new Error('No data returned from update');

          // 6. Replace optimistic data with real server data
          await config.dexieTable.put(result);

          // 7. Update cache with real server data
          queryClient.setQueriesData(
            { queryKey: config.getQueryKey() },
            (oldData: TData[] | undefined) => {
              if (!oldData) return undefined;
              return oldData.map(item =>
                (item as any).id === id ? result : item
              );
            }
          );

          return result;

        } catch (error) {
          // Rollback optimistic update on failure
          if (originalData) {
            await config.dexieTable.put(originalData);
            queryClient.setQueriesData(
              { queryKey: config.getQueryKey() },
              (oldData: TData[] | undefined) => {
                if (!oldData) return undefined;
                return oldData.map(item =>
                  (item as any).id === id ? originalData : item
                );
              }
            );
          }
          throw error;
        }
      },
      onSuccess: (data) => {
        if (config.onSuccessMessage) {
          toast.success(config.onSuccessMessage);
        }
        // Additional queries can still be invalidated
        const additionalQueries = config.invalidateQueries?.(data) || [];
        additionalQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });
      },
      onError: (error: Error) => {
        console.error(`Error updating ${config.tableName}:`, error);
        toast.error(config.onErrorMessage || `Failed to update ${config.tableName}`);
      },
      ...options,
    });
  };
}

/**
 * Generic delete mutation hook factory
 */
export function createDeleteHook<TData>(
  config: CRUDConfig<TData> & {
    onSuccessMessage?: string;
    onErrorMessage?: string;
    invalidateQueries?: (id: string) => QueryKey[];
    beforeDelete?: (id: string) => Promise<void>;
  }
) {
  return function useGenericDelete(
    options?: UseMutationOptions<void, Error, string>
  ) {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (id: string): Promise<void> => {
        // Run pre-delete hook if configured
        if (config.beforeDelete) {
          await config.beforeDelete(id);
        }

        let query = supabase
          .from(config.tableName)
          .delete()
          .eq('id', id);

        // Add user restriction if configured
        if (config.userId && config.userIdField) {
          query = query.eq(config.userIdField, config.userId);
        }

        const { error } = await query;
        if (error) throw error;

        // Remove from Dexie
        try {
          await config.dexieTable.delete(id);
        } catch (dexieError) {
          console.warn('Dexie removal failed:', dexieError);
        }
      },
      onSuccess: (_, id) => {
        // Invalidate relevant queries
        const baseQueries = [config.getQueryKey()];
        const additionalQueries = config.invalidateQueries?.(id) || [];

        [...baseQueries, ...additionalQueries].forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });

        if (config.onSuccessMessage) {
          toast.success(config.onSuccessMessage);
        }
      },
      onError: (error: Error) => {
        console.error(`Error deleting ${config.tableName}:`, error);
        toast.error(config.onErrorMessage || `Failed to delete ${config.tableName}`);
      },
      ...options,
    });
  };
}

/**
 * Complete CRUD hook factory - creates all operations at once
 */
export function createCRUDHooks<TData, TInsert = Partial<TData>, TUpdate = Partial<TData>>(
  config: CRUDConfig<TData, TInsert, TUpdate> & {
    select?: string;
    filters?: (params: any) => Record<string, any>;
    orderBy?: { column: string; ascending?: boolean }[];
    messages?: {
      createSuccess?: string;
      updateSuccess?: string;
      deleteSuccess?: string;
      createError?: string;
      updateError?: string;
      deleteError?: string;
    };
    invalidateQueries?: {
      onCreate?: (data: TData) => QueryKey[];
      onUpdate?: (data: TData) => QueryKey[];
      onDelete?: (id: string) => QueryKey[];
    };
    beforeDelete?: (id: string) => Promise<void>;
  }
) {
  const useQuery = createQueryHook(config);
  const useCreate = createCreateHook({
    ...config,
    onSuccessMessage: config.messages?.createSuccess,
    onErrorMessage: config.messages?.createError,
    invalidateQueries: config.invalidateQueries?.onCreate,
  });
  const useUpdate = createUpdateHook({
    ...config,
    onSuccessMessage: config.messages?.updateSuccess,
    onErrorMessage: config.messages?.updateError,
    invalidateQueries: config.invalidateQueries?.onUpdate,
  });
  const useDelete = createDeleteHook({
    ...config,
    onSuccessMessage: config.messages?.deleteSuccess,
    onErrorMessage: config.messages?.deleteError,
    invalidateQueries: config.invalidateQueries?.onDelete,
    beforeDelete: config.beforeDelete,
  });

  return {
    useQuery,
    useCreate,
    useUpdate,
    useDelete,
  };
}