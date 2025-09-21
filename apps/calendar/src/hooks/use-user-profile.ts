import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  timezone: string | null;
  time_format: "12_hour" | "24_hour" | null;
  week_start_day: "0" | "1" | "2" | "3" | "4" | "5" | "6" | null;
  title: string | null;
  organization: string | null;
}

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["userProfile", userId],
    queryFn: async (): Promise<UserProfile> => {
      if (!userId) throw new Error("User ID is required");

      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, first_name, last_name, display_name, avatar_url, slug, timezone, time_format, week_start_day, title, organization")
        .eq("id", userId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes - profiles don't change often
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}