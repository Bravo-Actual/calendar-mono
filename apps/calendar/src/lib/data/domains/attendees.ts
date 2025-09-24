/**
 * Event Attendees Unified Hooks
 * Handles attendee management for events using event_user_roles table
 *
 * Uses unified factory pattern for consistent CRUD operations
 * with optimistic updates and offline-first approach
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCRUDHooks } from '../base/factory';
import { db } from '../base/dexie';
import { keys } from '../base/keys';
import { generateId } from '../base/utils';
import { supabase } from '@/lib/supabase';
import type { EventUserRole } from '../base/dexie';

// Event User Roles (attendees) hooks using the unified factory
export const eventUserRoleHooks = (userId: string | undefined) =>
  createCRUDHooks<EventUserRole>({
    tableName: 'event_user_roles',
    dexieTable: db.event_user_roles,
    getQueryKey: () => keys.eventRoles(userId!),
    userId,
    userIdField: 'user_id',
    select: '*',
    orderBy: [
      { column: 'role', ascending: true }, // owners first, then others
      { column: 'updated_at', ascending: false },
    ],
    messages: {
      createSuccess: 'Attendee added',
      updateSuccess: 'Attendee updated',
      deleteSuccess: 'Attendee removed',
      createError: 'Failed to add attendee',
      updateError: 'Failed to update attendee',
      deleteError: 'Failed to remove attendee',
    },
    beforeDelete: async (roleId: string) => {
      // Prevent deletion of event owner role
      const role = await db.event_user_roles.get(roleId);
      if (role?.role === 'owner') {
        throw new Error('Cannot remove the event owner');
      }
    },
  });

// Get attendees for a specific event
export function useEventAttendees(eventId: string | undefined) {
  const { useQuery } = eventUserRoleHooks(undefined); // userId not needed for event-specific query

  return useQuery(undefined, {
    queryKey: ['eventAttendees', { eventId }],
    queryFn: async (): Promise<EventUserRole[]> => {
      if (!eventId) throw new Error('Event ID is required');

      const { data, error } = await supabase
        .from('event_user_roles')
        .select('*')
        .eq('event_id', eventId)
        .order('role', { ascending: true })
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Store in Dexie for offline access
      if (data?.length) {
        await db.event_user_roles.bulkPut(data);
      }

      return data || [];
    },
    enabled: !!eventId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

// Add attendee to event
export function useAddEventAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      userId,
      inviteType,
      role = 'viewer'
    }: {
      eventId: string;
      userId: string;
      inviteType: 'required' | 'optional';
      role?: 'viewer' | 'contributor' | 'owner' | 'delegate_full';
    }): Promise<EventUserRole> => {

      // Optimistic update
      const optimisticRole = {
        id: generateId(),
        event_id: eventId,
        user_id: userId,
        invite_type: inviteType,
        role,
        rsvp: null,
        rsvp_timestamp: null,
        attendance_type: null,
        following: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as EventUserRole;

      await db.event_user_roles.put(optimisticRole);

      // Optimistic cache update
      queryClient.setQueriesData(
        { queryKey: (k: any) => Array.isArray(k) && k[0] === 'eventAttendees' && k[1]?.eventId === eventId },
        (oldData: EventUserRole[] | undefined) => {
          if (!oldData) return [optimisticRole];
          return [...oldData, optimisticRole];
        }
      );

      try {
        // Server insert
        const { data, error } = await supabase
          .from('event_user_roles')
          .insert({
            event_id: eventId,
            user_id: userId,
            invite_type: inviteType,
            role,
          })
          .select()
          .single();

        if (error) throw error;

        // Replace optimistic with real data
        await db.event_user_roles.put(data);
        await db.event_user_roles.delete(optimisticRole.id);

        queryClient.setQueriesData(
          { queryKey: (k: any) => Array.isArray(k) && k[0] === 'eventAttendees' && k[1]?.eventId === eventId },
          (oldData: EventUserRole[] | undefined) => {
            if (!oldData) return [data];
            return oldData.map(item => item.id === optimisticRole.id ? data : item);
          }
        );

        return data;

      } catch (error) {
        // Rollback optimistic update
        await db.event_user_roles.delete(optimisticRole.id);
        queryClient.setQueriesData(
          { queryKey: (k: any) => Array.isArray(k) && k[0] === 'eventAttendees' && k[1]?.eventId === eventId },
          (oldData: EventUserRole[] | undefined) => {
            if (!oldData) return undefined;
            return oldData.filter(item => item.id !== optimisticRole.id);
          }
        );
        throw error;
      }
    },
  });
}

// Update attendee RSVP
export function useUpdateAttendeeRSVP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      eventId,
      rsvp,
      attendanceType
    }: {
      roleId: string;
      eventId: string;
      rsvp: 'tentative' | 'accepted' | 'declined';
      attendanceType?: 'in_person' | 'virtual';
    }): Promise<EventUserRole> => {

      // Get original for rollback
      const original = await db.event_user_roles.get(roleId);

      // Optimistic update
      const optimisticUpdate = {
        ...original,
        rsvp,
        attendance_type: attendanceType || original?.attendance_type || null,
        rsvp_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as EventUserRole;

      await db.event_user_roles.put(optimisticUpdate);

      // Optimistic cache update
      queryClient.setQueriesData(
        { queryKey: (k: any) => Array.isArray(k) && k[0] === 'eventAttendees' && k[1]?.eventId === eventId },
        (oldData: EventUserRole[] | undefined) => {
          if (!oldData) return undefined;
          return oldData.map(item => item.id === roleId ? optimisticUpdate : item);
        }
      );

      try {
        // Server update
        const { data, error } = await supabase
          .from('event_user_roles')
          .update({
            rsvp,
            attendance_type: attendanceType,
            rsvp_timestamp: new Date().toISOString(),
          })
          .eq('id', roleId)
          .select()
          .single();

        if (error) throw error;

        // Update with real server data
        await db.event_user_roles.put(data);

        queryClient.setQueriesData(
          { queryKey: (k: any) => Array.isArray(k) && k[0] === 'eventAttendees' && k[1]?.eventId === eventId },
          (oldData: EventUserRole[] | undefined) => {
            if (!oldData) return undefined;
            return oldData.map(item => item.id === roleId ? data : item);
          }
        );

        return data;

      } catch (error) {
        // Rollback optimistic update
        if (original) {
          await db.event_user_roles.put(original);
          queryClient.setQueriesData(
            { queryKey: (k: any) => Array.isArray(k) && k[0] === 'eventAttendees' && k[1]?.eventId === eventId },
            (oldData: EventUserRole[] | undefined) => {
              if (!oldData) return undefined;
              return oldData.map(item => item.id === roleId ? original : item);
            }
          );
        }
        throw error;
      }
    },
  });
}

// Remove attendee from event
export function useRemoveEventAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      eventId
    }: {
      roleId: string;
      eventId: string;
    }): Promise<void> => {

      // Get original for rollback
      const original = await db.event_user_roles.get(roleId);

      // Check if trying to remove owner
      if (original?.role === 'owner') {
        throw new Error('Cannot remove the event owner');
      }

      // Optimistic delete
      await db.event_user_roles.delete(roleId);

      // Optimistic cache update
      queryClient.setQueriesData(
        { queryKey: (k: any) => Array.isArray(k) && k[0] === 'eventAttendees' && k[1]?.eventId === eventId },
        (oldData: EventUserRole[] | undefined) => {
          if (!oldData) return undefined;
          return oldData.filter(item => item.id !== roleId);
        }
      );

      try {
        // Server delete
        const { error } = await supabase
          .from('event_user_roles')
          .delete()
          .eq('id', roleId);

        if (error) throw error;

      } catch (error) {
        // Rollback optimistic delete
        if (original) {
          await db.event_user_roles.put(original);
          queryClient.setQueriesData(
            { queryKey: (k: any) => Array.isArray(k) && k[0] === 'eventAttendees' && k[1]?.eventId === eventId },
            (oldData: EventUserRole[] | undefined) => {
              if (!oldData) return [original];
              return [...oldData, original];
            }
          );
        }
        throw error;
      }
    },
  });
}