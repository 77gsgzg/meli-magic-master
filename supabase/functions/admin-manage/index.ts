import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function maskEmail(email?: string | null): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userRes?.user) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }
    const caller = userRes.user;

    // Verify caller has admin role in DB (real authorization)
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      // Sanitized log (no email in clear text)
      await supabase.from("operation_logs").insert({
        user_id: caller.id,
        operation_type: "import",
        status: "error",
        entity_type: "admin",
        error_message: "forbidden_admin_access",
        details: {
          masked_email: maskEmail(caller.email),
          endpoint: "admin-manage",
        },
      });
      return jsonResp({ error: "Forbidden" }, 403);
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "list_users": {
        const limit = Math.min(Number(params.limit) || 50, 200);
        const page = Math.max(Number(params.page) || 1, 1);

        const { data: list, error: listErr } =
          await supabase.auth.admin.listUsers({ page, perPage: limit });
        if (listErr) throw listErr;

        const userIds = list.users.map((u) => u.id);

        const [{ data: roles }, { data: tokens }, { data: profiles }] =
          await Promise.all([
            supabase
              .from("user_roles")
              .select("user_id, role")
              .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
            supabase
              .from("ml_tokens")
              .select("user_id, nickname, expires_at, updated_at")
              .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
            supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
          ]);

        const rolesByUser = new Map<string, string[]>();
        (roles ?? []).forEach((r: any) => {
          const arr = rolesByUser.get(r.user_id) ?? [];
          arr.push(r.role);
          rolesByUser.set(r.user_id, arr);
        });

        const tokenByUser = new Map<string, any>();
        (tokens ?? []).forEach((t: any) => tokenByUser.set(t.user_id, t));

        const profileByUser = new Map<string, any>();
        (profiles ?? []).forEach((p: any) => profileByUser.set(p.id, p));

        const sanitized = list.users.map((u) => {
          const userRoles = rolesByUser.get(u.id) ?? [];
          const token = tokenByUser.get(u.id);
          const profile = profileByUser.get(u.id);
          return {
            id: u.id,
            masked_email: maskEmail(u.email),
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            confirmed: !!u.email_confirmed_at,
            banned_until: (u as any).banned_until ?? null,
            roles: userRoles,
            is_admin: userRoles.includes("admin"),
            ml_connected: !!token,
            ml_nickname: token?.nickname ?? null,
            ml_expires_at: token?.expires_at ?? null,
          };
        });

        return jsonResp({
          users: sanitized,
          total: list.total ?? sanitized.length,
          page,
          per_page: limit,
        });
      }

      case "promote_admin": {
        const { user_id } = params;
        if (!user_id) return jsonResp({ error: "user_id obrigatório" }, 400);

        const { error } = await supabase
          .from("user_roles")
          .upsert({ user_id, role: "admin" }, { onConflict: "user_id,role" });
        if (error) throw error;

        await supabase.from("operation_logs").insert({
          user_id: caller.id,
          operation_type: "update",
          status: "success",
          entity_type: "admin",
          entity_id: user_id,
          details: { action: "promote_admin" },
        });

        return jsonResp({ success: true });
      }

      case "demote_admin": {
        const { user_id } = params;
        if (!user_id) return jsonResp({ error: "user_id obrigatório" }, 400);
        if (user_id === caller.id)
          return jsonResp({ error: "Não pode rebaixar a si mesmo" }, 400);

        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .eq("role", "admin");
        if (error) throw error;

        await supabase.from("operation_logs").insert({
          user_id: caller.id,
          operation_type: "update",
          status: "success",
          entity_type: "admin",
          entity_id: user_id,
          details: { action: "demote_admin" },
        });

        return jsonResp({ success: true });
      }

      case "revoke_ml_token": {
        const { user_id } = params;
        if (!user_id) return jsonResp({ error: "user_id obrigatório" }, 400);

        const { error } = await supabase
          .from("ml_tokens")
          .delete()
          .eq("user_id", user_id);
        if (error) throw error;

        await supabase.from("operation_logs").insert({
          user_id: caller.id,
          operation_type: "delete",
          status: "success",
          entity_type: "ml_token",
          entity_id: user_id,
          details: { action: "revoke_ml_token" },
        });

        return jsonResp({ success: true });
      }

      case "user_logs": {
        const { user_id, limit = 25 } = params;
        if (!user_id) return jsonResp({ error: "user_id obrigatório" }, 400);

        const { data, error } = await supabase
          .from("operation_logs")
          .select("id, operation_type, status, entity_type, entity_id, error_message, created_at")
          .eq("user_id", user_id)
          .order("created_at", { ascending: false })
          .limit(Math.min(Number(limit) || 25, 100));
        if (error) throw error;

        return jsonResp({ logs: data ?? [] });
      }

      default:
        return jsonResp({ error: "Ação inválida" }, 400);
    }
  } catch (error) {
    console.error("admin-manage error:", error instanceof Error ? error.message : "unknown");
    return jsonResp(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
