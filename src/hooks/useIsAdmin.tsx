import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Verifica role 'admin' no banco (tabela user_roles).
 * Frontend é apenas reflexo — toda autorização real é validada no backend.
 */
export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function check() {
      if (authLoading) return;
      if (!user) {
        if (active) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (active) {
        setIsAdmin(!!data);
        setLoading(false);
      }
    }

    check();
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return { isAdmin, loading };
}
