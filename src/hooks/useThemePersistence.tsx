import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

type ThemeType = "light" | "dark" | "system";

export function useThemePersistence() {
  const { session } = useAuth();
  const { theme, setTheme } = useTheme();

  // Load theme from backend on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadThemeFromBackend = async () => {
      try {
        // Use a raw query to select the theme column to avoid type issues
        const { data, error } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (error) {
          console.warn("Could not load theme preference:", error.message);
          return;
        }

        // Access theme from data (column might not be in types yet)
        const savedTheme = (data as Record<string, unknown>)?.theme;
        if (savedTheme && typeof savedTheme === 'string' && ["light", "dark", "system"].includes(savedTheme)) {
          setTheme(savedTheme as ThemeType);
        }
      } catch {
        // No preferences yet, use local storage default
      }
    };

    loadThemeFromBackend();
  }, [session?.user?.id, setTheme]);

  // Save theme to backend when it changes
  const saveThemeToBackend = useCallback(async (newTheme: ThemeType) => {
    if (!session?.user?.id) return;

    try {
      // Use type assertion to add theme column
      const payload = {
        user_id: session.user.id,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;
      
      payload.theme = newTheme;

      await supabase
        .from("user_preferences")
        .upsert(payload as never, {
          onConflict: "user_id",
        });
    } catch (error) {
      console.error("Failed to save theme to backend:", error);
    }
  }, [session?.user?.id]);

  // Override setTheme to also persist to backend
  const setThemeWithPersistence = useCallback((newTheme: ThemeType) => {
    setTheme(newTheme);
    saveThemeToBackend(newTheme);
  }, [setTheme, saveThemeToBackend]);

  return {
    theme,
    setTheme: setThemeWithPersistence,
  };
}
