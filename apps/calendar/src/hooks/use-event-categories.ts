import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { EventCategory } from "@/components/types";

export interface UserEventCategory {
  id: string;
  user_id: string;
  name: string;
  color: EventCategory | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateEventCategoryData {
  name: string;
  color: EventCategory;
}

export interface UpdateEventCategoryData {
  id: string;
  name?: string;
  color?: EventCategory;
}

export function useEventCategories(userId: string | undefined) {
  return useQuery({
    queryKey: ["eventCategories", userId],
    queryFn: async (): Promise<UserEventCategory[]> => {
      if (!userId) throw new Error("User ID is required");

      const { data, error } = await supabase
        .from("user_categories")
        .select("*")
        .eq("user_id", userId)
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

export function useCreateEventCategory(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEventCategoryData): Promise<UserEventCategory> => {
      if (!userId) throw new Error("User ID is required");

      const { data: result, error } = await supabase
        .from("user_categories")
        .insert({
          user_id: userId,
          name: data.name,
          color: data.color,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventCategories", userId] });
    },
    onError: (error: Error & { code?: string }) => {
      console.error("Error creating category:", error);
      if (error.code === "23505") {
        toast.error("A category with this name already exists");
      } else {
        toast.error("Failed to create category");
      }
    },
  });
}

export function useUpdateEventCategory(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateEventCategoryData): Promise<UserEventCategory> => {
      const updateData: { name?: string; color?: EventCategory } = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.color !== undefined) updateData.color = data.color;

      const { data: result, error } = await supabase
        .from("user_categories")
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
      queryClient.invalidateQueries({ queryKey: ["eventCategories", userId] });
      toast.success("Category updated successfully");
    },
    onError: (error: Error & { code?: string }) => {
      console.error("Error updating category:", error);
      if (error.code === "23505") {
        toast.error("A category with this name already exists");
      } else {
        toast.error("Failed to update category");
      }
    },
  });
}

export function useDeleteEventCategory(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string): Promise<void> => {
      const { error } = await supabase
        .from("user_categories")
        .delete()
        .eq("id", categoryId)
        .eq("user_id", userId!);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventCategories", userId] });
      toast.success("Category deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    },
  });
}