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

async function logAction(
  supabase: any,
  caller_id: string,
  action: string,
  entity_id?: string,
  extra?: Record<string, unknown>,
) {
  await supabase.from("operation_logs").insert({
    user_id: caller_id,
    operation_type: "update",
    status: "success",
    entity_type: "admin",
    entity_id: entity_id ?? null,
    details: { action, ...(extra ?? {}) },
  });
}

async function auditAdmin(
  supabase: any,
  actor_id: string,
  target_id: string | null,
  action: string,
  reason: string | null,
  details?: Record<string, unknown>,
) {
  await supabase.from("admin_audit_logs").insert({
    actor_user_id: actor_id,
    target_user_id: target_id,
    action,
    reason,
    details: details ?? null,
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

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      await supabase.from("operation_logs").insert({
        user_id: caller.id,
        operation_type: "import",
        status: "error",
        entity_type: "admin",
        error_message: "forbidden_admin_access",
        details: { masked_email: maskEmail(caller.email), endpoint: "admin-manage" },
      });
      return jsonResp({ error: "Forbidden" }, 403);
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "dashboard_stats": {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const [
          { data: usersList },
          { count: mlCount },
          { data: planRows },
        ] = await Promise.all([
          supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
          supabase.from("ml_tokens").select("user_id", { count: "exact", head: true }),
          supabase.from("user_plans").select("plan_type, status"),
        ]);

        // active = signed in last 30 days (use full list for accuracy up to 1000)
        const { data: fullList } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const activeCount = (fullList?.users ?? []).filter(
          (u) => u.last_sign_in_at && u.last_sign_in_at >= since,
        ).length;

        const paying = (planRows ?? []).filter(
          (p: any) => p.plan_type !== "free" && p.status === "active",
        ).length;

        return jsonResp({
          total_users: usersList?.total ?? fullList?.users.length ?? 0,
          active_users_30d: activeCount,
          paying_users: paying,
          ml_connected: mlCount ?? 0,
        });
      }

      case "list_users": {
        const limit = Math.min(Number(params.limit) || 50, 200);
        const page = Math.max(Number(params.page) || 1, 1);
        const search = (params.search ?? "").toString().trim().toLowerCase();
        const filterAdmin = params.filter_admin === true;
        const filterPlan = params.filter_plan as string | undefined;

        const { data: list, error: listErr } =
          await supabase.auth.admin.listUsers({ page, perPage: limit });
        if (listErr) throw listErr;

        let users = list.users;
        if (search) {
          users = users.filter(
            (u) =>
              (u.email ?? "").toLowerCase().includes(search) ||
              u.id.toLowerCase().includes(search),
          );
        }

        const userIds = users.map((u) => u.id);
        const safeIds = userIds.length
          ? userIds
          : ["00000000-0000-0000-0000-000000000000"];

        const [
          { data: roles },
          { data: tokens },
          { data: profiles },
          { data: plans },
        ] = await Promise.all([
          supabase.from("user_roles").select("user_id, role").in("user_id", safeIds),
          supabase
            .from("ml_tokens")
            .select("user_id, nickname, expires_at, updated_at")
            .in("user_id", safeIds),
          supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", safeIds),
          supabase
            .from("user_plans")
            .select("user_id, plan_type, status, expires_at")
            .in("user_id", safeIds),
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
        const planByUser = new Map<string, any>();
        (plans ?? []).forEach((p: any) => planByUser.set(p.user_id, p));

        let sanitized = users.map((u) => {
          const userRoles = rolesByUser.get(u.id) ?? [];
          const token = tokenByUser.get(u.id);
          const profile = profileByUser.get(u.id);
          const plan = planByUser.get(u.id);
          const bannedUntil = (u as any).banned_until ?? null;
          const isBanned =
            bannedUntil && new Date(bannedUntil).getTime() > Date.now();
          return {
            id: u.id,
            masked_email: maskEmail(u.email),
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            confirmed: !!u.email_confirmed_at,
            banned_until: bannedUntil,
            is_banned: !!isBanned,
            roles: userRoles,
            is_admin: userRoles.includes("admin"),
            ml_connected: !!token,
            ml_nickname: token?.nickname ?? null,
            ml_expires_at: token?.expires_at ?? null,
            plan_type: plan?.plan_type ?? "free",
            plan_status: plan?.status ?? "active",
            plan_expires_at: plan?.expires_at ?? null,
          };
        });

        if (filterAdmin) sanitized = sanitized.filter((u) => u.is_admin);
        if (filterPlan && filterPlan !== "all") {
          sanitized = sanitized.filter((u) => u.plan_type === filterPlan);
        }

        return jsonResp({
          users: sanitized,
          total: list.total ?? sanitized.length,
          page,
          per_page: limit,
        });
      }

      case "promote_admin":
      case "demote_admin": {
        const { user_id } = params;
        if (!user_id) return jsonResp({ error: "user_id obrigatório" }, 400);
        if (action === "demote_admin" && user_id === caller.id)
          return jsonResp({ error: "Não pode rebaixar a si mesmo" }, 400);

        if (action === "promote_admin") {
          const { error } = await supabase
            .from("user_roles")
            .upsert({ user_id, role: "admin" }, { onConflict: "user_id,role" });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", user_id)
            .eq("role", "admin");
          if (error) throw error;
        }
        await logAction(supabase, caller.id, action, user_id);
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
        await logAction(supabase, caller.id, "revoke_ml_token", user_id);
        return jsonResp({ success: true });
      }

      case "user_logs": {
        const { user_id, limit = 25 } = params;
        if (!user_id) return jsonResp({ error: "user_id obrigatório" }, 400);

        const { data, error } = await supabase
          .from("operation_logs")
          .select(
            "id, operation_type, status, entity_type, entity_id, error_message, created_at",
          )
          .eq("user_id", user_id)
          .order("created_at", { ascending: false })
          .limit(Math.min(Number(limit) || 25, 100));
        if (error) throw error;

        return jsonResp({ logs: data ?? [] });
      }

      // ============ PLANS ============
      case "update_plan": {
        const { user_id, plan_type, status, expires_at } = params;
        if (!user_id) return jsonResp({ error: "user_id obrigatório" }, 400);
        if (!["free", "pro", "premium"].includes(plan_type))
          return jsonResp({ error: "plan_type inválido" }, 400);
        if (!["active", "expired", "canceled"].includes(status))
          return jsonResp({ error: "status inválido" }, 400);

        const { error } = await supabase.from("user_plans").upsert(
          {
            user_id,
            plan_type,
            status,
            expires_at: expires_at || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) throw error;
        await logAction(supabase, caller.id, "update_plan", user_id, {
          plan_type,
          status,
        });
        return jsonResp({ success: true });
      }

      // ============ BAN / SUSPEND / REACTIVATE ============
      case "ban_user":
      case "suspend_user":
      case "reactivate_user": {
        const { user_id, days } = params;
        if (!user_id) return jsonResp({ error: "user_id obrigatório" }, 400);
        if (user_id === caller.id)
          return jsonResp({ error: "Não pode aplicar a si mesmo" }, 400);

        let banDuration: string;
        if (action === "ban_user") {
          banDuration = "876600h"; // ~100 years
        } else if (action === "suspend_user") {
          const d = Math.max(Number(days) || 7, 1);
          banDuration = `${d * 24}h`;
        } else {
          banDuration = "none";
        }

        const { error } = await supabase.auth.admin.updateUserById(user_id, {
          ban_duration: banDuration,
        } as any);
        if (error) throw error;

        // Auto-revoke Mercado Livre token on ban/suspend
        let mlRevoked = false;
        if (action === "ban_user" || action === "suspend_user") {
          const { error: revokeErr } = await supabase
            .from("ml_tokens")
            .delete()
            .eq("user_id", user_id);
          if (!revokeErr) mlRevoked = true;

          // Force sign-out of all active sessions
          await supabase.auth.admin
            .signOut(user_id as any)
            .catch(() => undefined);
        }

        await logAction(supabase, caller.id, action, user_id, {
          days,
          ml_revoked: mlRevoked,
        });
        return jsonResp({ success: true, ml_revoked: mlRevoked });
      }

      // ============ SUPPORT ============
      case "list_tickets": {
        const status = params.status as string | undefined;
        const limit = Math.min(Number(params.limit) || 50, 100);
        let q = supabase
          .from("support_tickets")
          .select(
            "id, user_id, subject, message, admin_reply, status, replied_at, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(limit);
        if (status && status !== "all") q = q.eq("status", status);
        const { data, error } = await q;
        if (error) throw error;

        // attach masked email
        const ids = Array.from(new Set((data ?? []).map((t: any) => t.user_id)));
        const emailMap = new Map<string, string>();
        if (ids.length) {
          const { data: list } = await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
          (list?.users ?? []).forEach((u) => {
            if (ids.includes(u.id)) emailMap.set(u.id, maskEmail(u.email));
          });
        }
        const tickets = (data ?? []).map((t: any) => ({
          ...t,
          masked_email: emailMap.get(t.user_id) ?? "—",
        }));
        return jsonResp({ tickets });
      }

      case "reply_ticket": {
        const { ticket_id, reply, close } = params;
        if (!ticket_id || !reply)
          return jsonResp({ error: "ticket_id e reply obrigatórios" }, 400);
        if (typeof reply !== "string" || reply.length < 1 || reply.length > 5000)
          return jsonResp({ error: "reply inválido" }, 400);

        const { error } = await supabase
          .from("support_tickets")
          .update({
            admin_reply: reply,
            status: close ? "closed" : "answered",
            replied_by: caller.id,
            replied_at: new Date().toISOString(),
          })
          .eq("id", ticket_id);
        if (error) throw error;
        await logAction(supabase, caller.id, "reply_ticket", ticket_id);
        return jsonResp({ success: true });
      }

      default:
        return jsonResp({ error: "Ação inválida" }, 400);
    }
  } catch (error) {
    console.error(
      "admin-manage error:",
      error instanceof Error ? error.message : "unknown",
    );
    return jsonResp(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
