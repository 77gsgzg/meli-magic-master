import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SwipePreferences {
  hapticEnabled: boolean;
  soundEnabled: boolean;
}

/**
 * Fetches user swipe feedback preferences from the database.
 * Returns default values if user is not authenticated or preferences don't exist.
 */
export function useSwipePreferences(): SwipePreferences {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["swipe-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_preferences")
        .select("swipe_haptic_enabled, swipe_sound_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching swipe preferences:", error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    hapticEnabled: (data as any)?.swipe_haptic_enabled ?? true,
    soundEnabled: (data as any)?.swipe_sound_enabled ?? false,
  };
}
