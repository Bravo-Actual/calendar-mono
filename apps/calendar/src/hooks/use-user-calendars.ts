import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { EventCategory } from "@/components/types";

export interface UserEventCalendar {
  id: string;
  user_id: string;
  name: string;
  color: EventCategory;
  is_default: boolean;
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
        .from("user_event_calendars")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false }) // Default calendar first
        .order("name");

      if (error) {
        throw error;
      }

      return data || [];
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
        .from("user_event_calendars")
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

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCalendars", userId] });
      toast.success("Calendar created successfully");
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
        .from("user_event_calendars")
        .update(updateData)
        .eq("id", data.id)
        .eq("user_id", userId!)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCalendars", userId] });
      toast.success("Calendar updated successfully");
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
        .from("user_event_calendars")
        .select("is_default")
        .eq("id", calendarId)
        .eq("user_id", userId!)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (calendar?.is_default) {
        throw new Error("Cannot delete the default calendar");
      }

      const { error } = await supabase
        .from("user_event_calendars")
        .delete()
        .eq("id", calendarId)
        .eq("user_id", userId!);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCalendars", userId] });
      toast.success("Calendar deleted successfully");
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
        .from("user_event_calendars")
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