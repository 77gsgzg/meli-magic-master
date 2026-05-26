import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { logAuthEvent } from "@/lib/authTelemetry";

const SUPER_ADMIN_EMAIL = "farmatgu@gmail.com";

/**
 * Verifica role 'admin' no banco (tabela user_roles).
 * Frontend é apenas reflexo — toda autorização real é validada no backend.
 *
 * Fallback: se o e-mail do usuário for o super admin, considera admin
 * mesmo que a leitura da tabela falhe (ex: RLS / latência). O backend
 * continua sendo a fonte de verdade nas Edge Functions.
 */
export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function check() {
      if (authLoading) {
        logAuthEvent("user_roles_fetch_start", { source: "useIsAdmin", waitingForAuth: true });
        return;
      }
      if (!user) {
        if (active) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      const isSuperAdminByEmail =
        (user.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;

      logAuthEvent("user_roles_fetch_start", {
        source: "useIsAdmin",
        userId: user.id,
        role: "admin",
      });

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) {
        console.error("[user_roles-real-error]", error);
        console.error("[rls]", "user_roles admin SELECT failed", error);
        logAuthEvent("user_roles_fetch_error", {
          source: "useIsAdmin",
          userId: user.id,
          message: error.message,
          code: error.code,
        });
      } else {
        logAuthEvent("user_roles_fetch_resolved", {
          source: "useIsAdmin",
          userId: user.id,
          roles: data ? [data.role] : [],
          usedSuperAdminFallback: !data && isSuperAdminByEmail,
        });
      }

      if (active) {
        setIsAdmin(!!data || isSuperAdminByEmail);
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
