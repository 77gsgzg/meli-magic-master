import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

// Extend user_preferences to include theme (we'll use local storage as fallback)
const THEME_STORAGE_KEY = "ml-manager-theme";

export function useThemePersistence() {
  const { session } = useAuth();
  const { theme, setTheme } = useTheme();

  // Load theme from backend on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadThemeFromBackend = async () => {
      try {
        const { data } = await supabase
          .from("user_preferences")
          .select("timezone")
          .eq("user_id", session.user.id)
          .single();

        // We're using timezone field to store theme for now (hack)
        // In a real app, you'd add a theme column
        if (data?.timezone?.startsWith("theme:")) {
          const savedTheme = data.timezone.replace("theme:", "") as "light" | "dark" | "system";
          if (["light", "dark", "system"].includes(savedTheme)) {
            setTheme(savedTheme);
          }
        }
      } catch {
        // No preferences yet, use local storage
      }
    };

    loadThemeFromBackend();
  }, [session?.user?.id, setTheme]);

  // Save theme to backend when it changes
  const saveThemeToBackend = useCallback(async (newTheme: "light" | "dark" | "system") => {
    if (!session?.user?.id) return;

    try {
      await supabase
        .from("user_preferences")
        .upsert({
          user_id: session.user.id,
          timezone: `theme:${newTheme}`,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });
    } catch (error) {
      console.error("Failed to save theme to backend:", error);
    }
  }, [session?.user?.id]);

  // Override setTheme to also persist to backend
  const setThemeWithPersistence = useCallback((newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    saveThemeToBackend(newTheme);
  }, [setTheme, saveThemeToBackend]);

  return {
    theme,
    setTheme: setThemeWithPersistence,
  };
}
