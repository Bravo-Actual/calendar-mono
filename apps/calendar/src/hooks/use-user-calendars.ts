import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { EventCategory } from "@/components/types";

export interface UserEventCalendar {
  id: string;
  user_id: string;
  name: string;
  color: EventCategory;
  type: 'default' | 'archive' | 'user';
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEventCalendarData {
  name: string;
  color: EventCategory;
  visible?: boolean;
}

export interface UpdateEventCalendarData {
  id: string;
  name?: string;
  color?: EventCategory;
  visible?: boolean;
}

export function useUserCalendars(userId: string | undefined) {
  return useQuery({
    queryKey: ["userCalendars", userId],
    queryFn: async (): Promise<UserEventCalendar[]> => {
      if (!userId) throw new Error("User ID is required");

      const { data, error } = await supabase
        .from("user_calendars")
        .select("*")
        .eq("user_id", userId)
        .order("type", { ascending: true }) // Default calendar first ('default' < 'user')
        .order("name");

      if (error) {
        throw error;
      }

      return (data || []).map(calendar => ({
        ...calendar,
        color: calendar.color || 'neutral' as EventCategory,
        type: calendar.type,
        visible: calendar.visible !== false,
        created_at: calendar.created_at || '',
        updated_at: calendar.updated_at || ''
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

export function useCreateEventCalendar(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEventCalendarData): Promise<UserEventCalendar> => {
      if (!userId) throw new Error("User ID is required");

      const { data: result, error } = await supabase
        .from("user_calendars")
        .insert({
          user_id: userId,
          name: data.name,
          color: data.color,
          visible: data.visible !== undefined ? data.visible : true,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        ...result,
        color: result.color || 'neutral' as EventCategory,
        type: result.type,
        visible: result.visible !== false,
        created_at: result.created_at || '',
        updated_at: result.updated_at || ''
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCalendars", userId] });
    },
    onError: (error: Error & { code?: string }) => {
      console.error("Error creating calendar:", error);
      if (error.code === "23505") {
        toast.error("A calendar with this name already exists");
      } else {
        toast.error("Failed to create calendar");
      }
    },
  });
}

export function useUpdateEventCalendar(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateEventCalendarData): Promise<UserEventCalendar> => {
      const updateData: { name?: string; color?: EventCategory; visible?: boolean } = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.visible !== undefined) updateData.visible = data.visible;

      const { data: result, error } = await supabase
        .from("user_calendars")
        .update(updateData)
        .eq("id", data.id)
        .eq("user_id", userId!)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        ...result,
        color: result.color || 'neutral' as EventCategory,
        type: result.type,
        visible: result.visible !== false,
        created_at: result.created_at || '',
        updated_at: result.updated_at || ''
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCalendars", userId] });
    },
    onError: (error: Error & { code?: string }) => {
      console.error("Error updating calendar:", error);
      if (error.code === "23505") {
        toast.error("A calendar with this name already exists");
      } else {
        toast.error("Failed to update calendar");
      }
    },
  });
}

export function useDeleteEventCalendar(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (calendarId: string): Promise<void> => {
      // First check if this is the default calendar
      const { data: calendar, error: fetchError } = await supabase
        .from("user_calendars")
        .select("type")
        .eq("id", calendarId)
        .eq("user_id", userId!)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (calendar?.type !== 'user') {
        throw new Error("Cannot delete system calendars");
      }

      // Find the default calendar to reassign events to
      const { data: defaultCalendar, error: defaultError } = await supabase
        .from("user_calendars")
        .select("id")
        .eq("user_id", userId!)
        .eq("type", "default")
        .single();

      if (defaultError) {
        throw defaultError;
      }

      // Update all event_details_personal records that reference this calendar
      // to use the default calendar instead
      const { error: updateError } = await supabase
        .from("event_details_personal")
        .update({ calendar_id: defaultCalendar.id })
        .eq("calendar_id", calendarId)
        .eq("user_id", userId!);

      if (updateError) {
        throw updateError;
      }

      // Now delete the calendar
      const { error } = await supabase
        .from("user_calendars")
        .delete()
        .eq("id", calendarId)
        .eq("user_id", userId!);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCalendars", userId] });
      // Also invalidate events queries since events may have been reassigned to default calendar
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error: Error) => {
      console.error("Error deleting calendar:", error);
      if (error.message === "Cannot delete the default calendar") {
        toast.error("Cannot delete the default calendar");
      } else {
        toast.error("Failed to delete calendar");
      }
    },
  });
}

export function useToggleCalendarVisibility(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ calendarId, visible }: { calendarId: string; visible: boolean }): Promise<void> => {
      const { error } = await supabase
        .from("user_calendars")
        .update({ visible })
        .eq("id", calendarId)
        .eq("user_id", userId!);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCalendars", userId] });
    },
    onError: (error: Error) => {
      console.error("Error toggling calendar visibility:", error);
      toast.error("Failed to update calendar visibility");
    },
  });
}